"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { removeMediaIfUnused, revalidateProducts, storagePathFromUrl, upsertRedirect } from "@/lib/admin/catalog-server";
import { descendantsOf } from "@/lib/admin/category-tree";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { isStoreMediaPath } from "@/lib/media";
import { categorySchema, reorderCategoriesSchema } from "@/lib/schemas/category";
import { uniqueSlug } from "@/lib/slug";

/*
 * Server Actions de categorías (agente A).
 */

async function slugTaken(ctx: AdminContext, slug: string, exceptId?: string | null) {
  let q = ctx.supabase.from("categories").select("id").eq("store_id", ctx.store.id).eq("slug", slug).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  return Boolean(data?.length);
}

export async function saveCategory(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data = parsed.data;
    const { supabase } = ctx;

    const { data: all } = await supabase
      .from("categories")
      .select("id, parent_id, position, name, slug, image_url, is_visible")
      .eq("store_id", ctx.store.id);
    const categories = all ?? [];
    const before = data.id ? categories.find((c) => c.id === data.id) : undefined;
    if (data.id && !before) return fail("La categoría ya no existe. Recargá la página.");

    if (data.parent_id) {
      if (data.parent_id === data.id) return fail("Revisá los campos marcados.", { parent_id: ["No puede ser su propia madre."] });
      if (data.id && descendantsOf(categories, data.id).has(data.parent_id)) {
        return fail("Revisá los campos marcados.", { parent_id: ["No puede quedar dentro de una de sus subcategorías."] });
      }
      if (!categories.some((c) => c.id === data.parent_id)) {
        return fail("Revisá los campos marcados.", { parent_id: ["La categoría madre ya no existe."] });
      }
    }
    const imagePath = data.image_url ? storagePathFromUrl(data.image_url) : null;
    if (
      data.image_url &&
      !(imagePath && isStoreMediaPath(imagePath, ctx.store.id, "categories")) &&
      data.image_url !== before?.image_url
    ) {
      return fail("Revisá los campos marcados.", { image_url: ["Subí la imagen desde este formulario."] });
    }

    let slug = data.slug;
    if (slug) {
      if (await slugTaken(ctx, slug, data.id)) {
        return fail("Revisá los campos marcados.", { slug: ["Ya hay otra categoría con esta URL."] });
      }
    } else {
      slug = before?.slug ?? (await uniqueSlug(data.name, (s) => slugTaken(ctx, s, data.id)));
    }

    const row = {
      name: data.name,
      slug,
      parent_id: data.parent_id,
      description: data.description,
      image_url: data.image_url,
      is_visible: data.is_visible,
      seo: { title: data.seo.title, description: data.seo.description },
    };

    let id: string;
    if (before) {
      const patch = before.parent_id === data.parent_id ? row : { ...row, position: nextPosition(categories, data.parent_id) };
      const { error } = await supabase.from("categories").update(patch).eq("store_id", ctx.store.id).eq("id", before.id);
      if (error) throw new Error(error.message);
      id = before.id;
      if (before.slug !== slug) await upsertRedirect(ctx, `/categoria/${before.slug}`, `/categoria/${slug}`);
      if (before.image_url && before.image_url !== data.image_url) await removeMediaIfUnused(ctx, [before.image_url]);
    } else {
      const { data: created, error } = await supabase
        .from("categories")
        .insert({ ...row, store_id: ctx.store.id, position: nextPosition(categories, data.parent_id) })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = created.id;
    }

    await logAudit(ctx, {
      action: before ? "category.update" : "category.create",
      entity: "category",
      entityId: id,
      summary: before ? `Editó la categoría ${data.name}` : `Creó la categoría ${data.name}`,
      diff: before
        ? shallowDiff(
            { name: before.name, slug: before.slug, parent_id: before.parent_id, is_visible: before.is_visible },
            { name: data.name, slug, parent_id: data.parent_id, is_visible: data.is_visible },
          )
        : undefined,
    });
    revalidateProducts(ctx.store.id, [], true);
    refresh();
    return ok({ id, slug });
  });
}

function nextPosition(categories: { parent_id: string | null; position: number }[], parentId: string | null) {
  const siblings = categories.filter((c) => c.parent_id === parentId);
  return siblings.length ? Math.max(...siblings.map((c) => c.position)) + 1 : 0;
}

export async function reorderCategories(input: unknown): Promise<ActionResult<{ changed: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = reorderCategoriesSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, "El orden no es válido.");
    const { data, error } = await ctx.supabase.rpc("reorder_categories", { p_store_id: ctx.store.id, items: parsed.data });
    if (error) return fail(error.message.includes("sí misma") ? "Una categoría no puede quedar dentro de sí misma." : "No se pudo guardar el orden.");
    const changed = typeof data === "number" ? data : 0;
    if (changed) {
      await logAudit(ctx, { action: "category.reorder", entity: "category", summary: `Reordenó ${changed} categorías` });
      revalidateProducts(ctx.store.id, [], true);
    }
    return ok({ changed });
  });
}

export async function deleteCategory(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!z.string().uuid().safeParse(id).success) return fail("Categoría inválida.");
    const { supabase } = ctx;
    const storeId = ctx.store.id;
    const { data: cat } = await supabase
      .from("categories")
      .select("id, name, slug, image_url")
      .eq("store_id", storeId)
      .eq("id", id)
      .maybeSingle();
    if (!cat) return ok({ id });
    const { count: children } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("parent_id", id);
    if (children) return fail("Tiene subcategorías. Movelas o borralas primero.");
    const { count: products } = await supabase
      .from("product_categories")
      .select("product_id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("category_id", id);

    const { error } = await supabase.from("categories").delete().eq("store_id", storeId).eq("id", id);
    if (error) throw new Error(error.message);
    await supabase.from("redirects").delete().eq("store_id", storeId).eq("to_path", `/categoria/${cat.slug}`);
    if (cat.image_url) await removeMediaIfUnused(ctx, [cat.image_url]);

    await logAudit(ctx, {
      action: "category.delete",
      entity: "category",
      entityId: id,
      summary: `Borró la categoría ${cat.name}${products ? ` (${products} productos quedaron sin ella)` : ""}`,
    });
    revalidateProducts(storeId, [], true);
    refresh();
    return ok({ id });
  });
}
