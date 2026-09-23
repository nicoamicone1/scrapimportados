"use server";

import { nanoid } from "nanoid";
import { refresh } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { catalogDb } from "@/lib/admin/catalog-db";
import { afterStockIncrease } from "@/lib/admin/inventory-alerts";
import { MEDIA_BUCKET, removeMediaIfUnused, revalidateProducts, storagePathFromUrl, upsertRedirect } from "@/lib/admin/catalog-server";
import { getAdminProduct, searchTerm, type AdminImage, type AdminProductDetail, type ProductSummary } from "@/lib/admin/products";
import { cleanSpecs, type SpecRow } from "@/lib/admin/specs";
import { optionKey, type OptionValues } from "@/lib/admin/variant-matrix";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/html";
import { isStoreMediaPath, mediaPath } from "@/lib/media";
import { limitOf } from "@/lib/plans";
import { assertProductImages, assertUsage } from "@/lib/plans/server";
import {
  addImagesSchema,
  bulkProductSchema,
  duplicateSchema,
  inlineEditSchema,
  productSchema,
  type BulkProductAction,
  type ProductData,
} from "@/lib/schemas/product";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { Json, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

/*
 * Server Actions de productos (agente A). Todas: requireAdmin → zod →
 * escribir → logAudit → revalidateTag → ActionResult.
 */

const idSchema = z.string().uuid();

async function slugTaken(ctx: AdminContext, slug: string, exceptId?: string | null) {
  let q = ctx.supabase.from("products").select("id").eq("store_id", ctx.store.id).eq("slug", slug).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  return Boolean(data?.length);
}

/** De estos ids, los que existen en la tabla dentro de la tienda activa (mismo orden). */
async function ownIds(ctx: AdminContext, table: "products" | "categories", ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await ctx.supabase.from(table).select("id").eq("store_id", ctx.store.id).in("id", ids);
  const found = new Set((data ?? []).map((r) => r.id));
  return ids.filter((id) => found.has(id));
}

/** jsonb de la DB → OptionValues (para comparar combinaciones). */
function dbOptionKey(value: Json): string {
  const out: OptionValues = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) if (typeof v === "string") out[k] = v;
  }
  return optionKey(out);
}

function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

// ---------------------------------------------------------------------------
// Guardar (crear / editar)
// ---------------------------------------------------------------------------

export async function saveProduct(input: unknown): Promise<ActionResult<{ product: AdminProductDetail }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const { supabase } = ctx;
    const storeId = ctx.store.id;
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const data: ProductData = parsed.data;
    const isNew = !data.id;

    // Producto actual (si existe).
    let before: { id: string; slug: string; status: string; published_at: string | null; name: string } | null = null;
    if (data.id) {
      const { data: row } = await supabase
        .from("products")
        .select("id, slug, status, published_at, name")
        .eq("store_id", storeId)
        .eq("id", data.id)
        .maybeSingle();
      if (!row) return fail("El producto ya no existe. Recargá la página.");
      before = row;
    }

    // Límite de productos del plan (los archivados no cuentan).
    const wasCounted = before ? before.status !== "archived" : false;
    if (data.status !== "archived" && !wasCounted) await assertUsage(ctx, "products", 1);

    // Slug: explícito (debe estar libre) o generado desde el nombre.
    let slug = data.slug;
    if (slug) {
      if (await slugTaken(ctx, slug, data.id)) {
        return fail("Revisá los campos marcados.", { slug: ["Ya hay otro producto con esta URL."] });
      }
    } else {
      slug = before?.slug ?? (await uniqueSlug(data.name, (s) => slugTaken(ctx, s, data.id)));
    }

    // SKU único en toda la tienda.
    const skus = data.variants.map((v) => v.sku).filter((s): s is string => Boolean(s));
    if (skus.length) {
      let q = supabase.from("product_variants").select("sku, product_id, products(name)").eq("store_id", storeId).in("sku", skus);
      if (data.id) q = q.neq("product_id", data.id);
      const { data: clashes } = await q;
      if (clashes?.length) {
        const fieldErrors: Record<string, string[]> = {};
        data.variants.forEach((v, i) => {
          const clash = clashes.find((c) => c.sku && v.sku && c.sku.toLowerCase() === v.sku.toLowerCase());
          if (clash) fieldErrors[`variants.${i}.sku`] = [`Ya lo usa «${clash.products?.name ?? "otro producto"}».`];
        });
        if (Object.keys(fieldErrors).length) return fail("Hay SKUs repetidos.", fieldErrors);
      }
    }

    const now = new Date().toISOString();
    const row = {
      name: data.name,
      slug,
      description_html: sanitizeHtml(data.description_html) || null,
      short_description: data.short_description,
      status: data.status,
      brand: data.brand,
      tags: [...new Set(data.tags)],
      featured: data.featured,
      vat_percent: data.vat_percent,
      options: toJson(data.options.map((o) => ({ name: o.name, values: o.values }))),
      seo: toJson({ title: data.seo.title, description: data.seo.description }),
      specs: toJson(cleanSpecs(data.specs)),
      related_ids: await ownIds(
        ctx,
        "products",
        [...new Set(data.related_ids)].filter((id) => id !== data.id),
      ),
      published_at: data.status === "active" ? (before?.published_at ?? now) : (before?.published_at ?? null),
    } satisfies TablesUpdate<"products">;

    let productId: string;
    if (before) {
      const { error } = await supabase.from("products").update(row).eq("store_id", storeId).eq("id", before.id);
      if (error) throw new Error(error.message);
      productId = before.id;
    } else {
      const { data: created, error } = await supabase
        .from("products")
        .insert({ ...row, store_id: storeId, source: "manual" } satisfies TablesInsert<"products">)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      productId = created.id;
    }

    // Categorías.
    const categoryIds = await ownIds(ctx, "categories", [...new Set(data.category_ids)]);
    {
      let del = supabase.from("product_categories").delete().eq("store_id", storeId).eq("product_id", productId);
      if (categoryIds.length) del = del.not("category_id", "in", `(${categoryIds.join(",")})`);
      const { error: delErr } = await del;
      if (delErr) throw new Error(delErr.message);
      if (categoryIds.length) {
        const { error } = await supabase
          .from("product_categories")
          .upsert(
            categoryIds.map((category_id, position) => ({ store_id: storeId, product_id: productId, category_id, position })),
            { onConflict: "product_id,category_id" },
          );
        if (error) throw new Error(error.message);
      }
    }

    // Variantes.
    const { data: existingRows } = await supabase
      .from("product_variants")
      .select("id, option_values")
      .eq("store_id", storeId)
      .eq("product_id", productId);
    const existing = new Map((existingRows ?? []).map((v) => [v.id, v]));
    const { data: imageRows } = await supabase
      .from("product_images")
      .select("id")
      .eq("store_id", storeId)
      .eq("product_id", productId);
    const imageIds = new Set((imageRows ?? []).map((i) => i.id));

    const keep = data.variants.filter((v) => v.id && existing.has(v.id));
    const keepIds = new Set(keep.map((v) => v.id as string));
    const removeIds = [...existing.keys()].filter((id) => !keepIds.has(id));
    if (removeIds.length) {
      const { error } = await supabase.from("product_variants").delete().eq("store_id", storeId).in("id", removeIds);
      if (error) throw new Error(error.message);
    }

    const variantRow = (v: ProductData["variants"][number], position: number) => ({
      title: v.title || "Default",
      option_values: toJson(v.option_values),
      sku: v.sku,
      barcode: v.barcode,
      price: v.price,
      compare_at_price: v.compare_at_price && v.compare_at_price > 0 ? v.compare_at_price : null,
      cost: v.cost,
      track_inventory: v.track_inventory,
      allow_backorder: v.allow_backorder,
      low_stock_threshold: v.low_stock_threshold,
      weight_grams: v.weight_grams,
      image_id: v.image_id && imageIds.has(v.image_id) ? v.image_id : null,
      position,
      is_active: v.is_active,
    });

    // Evitar choques del unique (product_id, option_values) al reasignar combinaciones.
    const changedCombos = keep.filter(
      (v) => dbOptionKey(existing.get(v.id as string)?.option_values ?? {}) !== optionKey(v.option_values),
    );
    await Promise.all(
      changedCombos.map((v) =>
        supabase
          .from("product_variants")
          .update({ option_values: { __tmp: v.id as string } })
          .eq("store_id", storeId)
          .eq("id", v.id as string),
      ),
    );

    const positions = new Map(data.variants.map((v, i) => [v, i]));
    for (let i = 0; i < keep.length; i += 10) {
      const results = await Promise.all(
        keep.slice(i, i + 10).map((v) =>
          supabase
            .from("product_variants")
            .update(variantRow(v, positions.get(v) ?? 0))
            .eq("store_id", storeId)
            .eq("id", v.id as string),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    }

    const fresh = data.variants.filter((v) => !v.id || !existing.has(v.id));
    const stockNote = data.stock_note ?? null;
    if (fresh.length) {
      const { data: inserted, error } = await supabase
        .from("product_variants")
        .insert(
          fresh.map((v) => ({ ...variantRow(v, positions.get(v) ?? 0), store_id: storeId, product_id: productId, stock: 0 })),
        )
        .select("id, option_values");
      if (error) throw new Error(error.message);
      // Stock inicial por adjust_stock (queda el movimiento).
      for (const v of fresh) {
        if (!v.stock) continue;
        const match = inserted?.find((r) => dbOptionKey(r.option_values) === optionKey(v.option_values));
        if (!match) continue;
        const { error: adjErr } = await supabase.rpc("adjust_stock", {
          p_variant_id: match.id,
          p_delta: v.stock,
          p_reason: "adjustment",
          p_note: stockNote ?? "Stock inicial",
        });
        if (adjErr) throw new Error(adjErr.message);
      }
    }

    // Cambios de stock de variantes existentes: por la diferencia con lo que vio el admin.
    for (const v of keep) {
      if (v.stock_original === null || v.stock_original === undefined) continue;
      const delta = v.stock - v.stock_original;
      if (!delta) continue;
      const { error } = await supabase.rpc("adjust_stock", {
        p_variant_id: v.id as string,
        p_delta: delta,
        p_reason: "adjustment",
        p_note: stockNote ?? "Ajuste desde la ficha del producto",
      });
      if (error) throw new Error(error.message);
    }

    // Redirección si cambió el slug.
    if (before && before.slug !== slug) {
      await upsertRedirect(ctx, `/producto/${before.slug}`, `/producto/${slug}`);
    }

    await logAudit(ctx, {
      action: isNew ? "product.create" : "product.update",
      entity: "product",
      entityId: productId,
      summary: isNew ? `Creó el producto ${data.name}` : `Editó el producto ${data.name}`,
      diff: before
        ? shallowDiff(
            { name: before.name, slug: before.slug, status: before.status },
            { name: data.name, slug, status: data.status },
          )
        : undefined,
    });

    revalidateProducts(storeId, [slug, before?.slug], true);
    // Avisos de stock: stock subido, seguimiento apagado, venta sin stock activada o
    // variantes regeneradas (las nuevas no tienen avisos propios: se pasa el producto).
    afterStockIncrease(ctx, [...keepIds], [productId]);
    const product = await getAdminProduct(productId);
    if (!product) return fail("No se pudo leer el producto guardado.");
    return ok({ product });
  });
}

// ---------------------------------------------------------------------------
// Edición inline (listado)
// ---------------------------------------------------------------------------

export async function inlineUpdateVariant(
  input: unknown,
): Promise<ActionResult<{ price: number; compareAtPrice: number | null; stock: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = inlineEditSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, parsed.error.issues[0]?.message);
    const d = parsed.data;
    const { data: v } = await ctx.supabase
      .from("product_variants")
      .select("id, price, compare_at_price, stock, product_id, products(slug, name)")
      .eq("store_id", ctx.store.id)
      .eq("id", d.variantId)
      .eq("product_id", d.productId)
      .maybeSingle();
    if (!v) return fail("La variante ya no existe. Recargá la página.");

    const patch: TablesUpdate<"product_variants"> = {};
    if (d.price !== undefined) patch.price = d.price;
    if (d.compare_at_price !== undefined) patch.compare_at_price = d.compare_at_price && d.compare_at_price > 0 ? d.compare_at_price : null;
    const nextPrice = patch.price ?? Number(v.price);
    const nextCompare = patch.compare_at_price !== undefined ? patch.compare_at_price : v.compare_at_price;
    if (nextCompare !== null && nextCompare !== undefined && Number(nextCompare) <= nextPrice) {
      return fail("El precio tachado tiene que ser mayor al precio.");
    }
    if (Object.keys(patch).length) {
      const { error } = await ctx.supabase.from("product_variants").update(patch).eq("store_id", ctx.store.id).eq("id", v.id);
      if (error) throw new Error(error.message);
    }

    let stock = v.stock;
    if (d.stock !== undefined) {
      const delta = d.stock - (d.stock_original ?? v.stock);
      if (delta) {
        const { data: after, error } = await ctx.supabase.rpc("adjust_stock", {
          p_variant_id: v.id,
          p_delta: delta,
          p_reason: "adjustment",
          p_note: "Edición rápida desde el listado",
        });
        if (error) throw new Error(error.message);
        stock = after;
      }
    }

    await logAudit(ctx, {
      action: "product.inline_update",
      entity: "product",
      entityId: v.product_id,
      summary: `Editó precio/stock de ${v.products?.name ?? "un producto"}`,
      diff: shallowDiff(
        { price: Number(v.price), compare_at_price: v.compare_at_price, stock: v.stock },
        { price: nextPrice, compare_at_price: nextCompare ?? null, stock },
      ),
    });
    revalidateProducts(ctx.store.id, [v.products?.slug]);
    if (stock > v.stock) afterStockIncrease(ctx, [v.id]);
    return ok({ price: nextPrice, compareAtPrice: nextCompare === null || nextCompare === undefined ? null : Number(nextCompare), stock });
  });
}

// ---------------------------------------------------------------------------
// Acciones masivas
// ---------------------------------------------------------------------------

const BULK_LABELS: Record<BulkProductAction, string> = {
  publish: "Publicó",
  draft: "Pasó a borrador",
  archive: "Archivó",
  restore: "Restauró",
  add_category: "Asignó categoría a",
  remove_category: "Quitó categoría de",
};

export async function bulkProducts(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = bulkProductSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error, parsed.error.issues[0]?.message);
    const { ids, action, categoryId } = parsed.data;
    const { supabase } = ctx;
    const storeId = ctx.store.id;

    const { data: rows } = await supabase.from("products").select("id, slug, status").eq("store_id", storeId).in("id", ids);
    const found = rows ?? [];
    if (!found.length) return fail("Los productos ya no existen.");
    const foundIds = found.map((r) => r.id);

    if (action === "publish" || action === "draft" || action === "archive" || action === "restore") {
      const status = action === "publish" ? "active" : action === "archive" ? "archived" : "draft";
      // Sacar productos del archivo vuelve a contarlos contra el límite del plan.
      const unarchiving = status === "archived" ? 0 : found.filter((r) => r.status === "archived").length;
      if (unarchiving) await assertUsage(ctx, "products", unarchiving);
      const { error } = await supabase.from("products").update({ status }).eq("store_id", storeId).in("id", foundIds);
      if (error) throw new Error(error.message);
      if (status === "active") {
        await supabase
          .from("products")
          .update({ published_at: new Date().toISOString() })
          .eq("store_id", storeId)
          .in("id", foundIds)
          .is("published_at", null);
      }
    } else if (action === "add_category" && categoryId) {
      if (!(await ownIds(ctx, "categories", [categoryId])).length) return fail("La categoría ya no existe.");
      const { error } = await supabase
        .from("product_categories")
        .upsert(foundIds.map((product_id) => ({ store_id: storeId, product_id, category_id: categoryId, position: 99 })), {
          onConflict: "product_id,category_id",
          ignoreDuplicates: true,
        });
      if (error) throw new Error(error.message);
    } else if (action === "remove_category" && categoryId) {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("store_id", storeId)
        .eq("category_id", categoryId)
        .in("product_id", foundIds);
      if (error) throw new Error(error.message);
    }

    await logAudit(ctx, {
      action: `product.bulk_${action}`,
      entity: "product",
      summary: `${BULK_LABELS[action]} ${found.length} producto${found.length === 1 ? "" : "s"}`,
      diff: toJson({ ids: foundIds, categoryId: categoryId ?? null }),
    });
    revalidateProducts(
      storeId,
      found.map((r) => r.slug),
      action === "add_category" || action === "remove_category",
    );
    refresh();
    return ok({ count: found.length });
  });
}

// ---------------------------------------------------------------------------
// Duplicar
// ---------------------------------------------------------------------------

export async function duplicateProduct(id: string, options: { images: boolean } = { images: true }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = duplicateSchema.safeParse({ id, images: options.images });
    if (!parsed.success) return zodFail(parsed.error);
    const { supabase } = ctx;
    const storeId = ctx.store.id;

    const { data: src } = await supabase
      .from("products")
      .select("*, product_variants(*), product_images(*), product_categories(category_id, position)")
      .eq("store_id", storeId)
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!src) return fail("El producto ya no existe.");
    await assertUsage(ctx, "products", 1);

    const slug = await uniqueSlug(`${src.slug}-copia`, (s) => slugTaken(ctx, s));
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        store_id: storeId,
        name: `Copia de ${src.name}`.slice(0, 200),
        slug,
        description_html: src.description_html,
        short_description: src.short_description,
        status: "draft",
        brand: src.brand,
        tags: src.tags,
        featured: false,
        options: src.options,
        seo: {},
        source: "manual",
        specs: src.specs,
        related_ids: src.related_ids,
        vat_percent: src.vat_percent,
        metadata: { duplicated_from: src.id },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const newId = created.id;

    if (src.product_categories?.length) {
      await supabase
        .from("product_categories")
        .insert(
          src.product_categories.map((c) => ({ store_id: storeId, product_id: newId, category_id: c.category_id, position: c.position })),
        );
    }

    // Imágenes: se copian los archivos del bucket (cada producto tiene los suyos).
    const imageMap = new Map<string, string>();
    if (parsed.data.images && src.product_images?.length) {
      // Si el plan bajó, la copia se queda con las primeras fotos que entren.
      const maxImages = limitOf(ctx.plan, "images_per_product");
      const images = [...src.product_images].sort((a, b) => a.position - b.position).slice(0, maxImages ?? undefined);
      for (const img of images) {
        let url = img.url;
        const path = storagePathFromUrl(img.url);
        if (path && isStoreMediaPath(path, storeId)) {
          const ext = path.split(".").pop() ?? "webp";
          const target = mediaPath(storeId, "products", newId, `${nanoid(10)}.${ext}`);
          const { error: copyErr } = await supabase.storage.from(MEDIA_BUCKET).copy(path, target);
          if (!copyErr) url = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(target).data.publicUrl;
        }
        const { data: newImg } = await supabase
          .from("product_images")
          .insert({
            store_id: storeId,
            product_id: newId,
            url,
            alt: img.alt,
            position: img.position,
            width: img.width,
            height: img.height,
          })
          .select("id")
          .single();
        if (newImg) imageMap.set(img.id, newImg.id);
      }
    }

    const variants = [...(src.product_variants ?? [])].sort((a, b) => a.position - b.position);
    if (variants.length) {
      const { error: vErr } = await supabase.from("product_variants").insert(
        variants.map((v) => ({
          store_id: storeId,
          product_id: newId,
          title: v.title,
          option_values: v.option_values,
          sku: null,
          barcode: null,
          price: v.price,
          compare_at_price: v.compare_at_price,
          cost: v.cost,
          stock: 0,
          track_inventory: v.track_inventory,
          allow_backorder: v.allow_backorder,
          low_stock_threshold: v.low_stock_threshold,
          weight_grams: v.weight_grams,
          image_id: v.image_id ? (imageMap.get(v.image_id) ?? null) : null,
          position: v.position,
          is_active: v.is_active,
        })),
      );
      if (vErr) throw new Error(vErr.message);
    } else {
      await supabase.from("product_variants").insert({ store_id: storeId, product_id: newId, title: "Default", price: 0, stock: 0 });
    }

    await logAudit(ctx, {
      action: "product.duplicate",
      entity: "product",
      entityId: newId,
      summary: `Duplicó ${src.name}`,
      diff: toJson({ from: src.id, images: parsed.data.images }),
    });
    revalidateProducts(storeId, [], true);
    return ok({ id: newId });
  });
}

// ---------------------------------------------------------------------------
// Estado individual y borrado definitivo
// ---------------------------------------------------------------------------

export async function setProductStatus(
  id: string,
  status: "draft" | "active" | "archived",
): Promise<ActionResult<{ status: string }>> {
  const action: BulkProductAction = status === "active" ? "publish" : status === "archived" ? "archive" : "draft";
  const res = await bulkProducts({ ids: [id], action });
  return res.ok ? ok({ status }) : res;
}

export async function deleteProduct(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return fail("Producto inválido.");
    const { supabase } = ctx;
    const storeId = ctx.store.id;

    const { data: p } = await supabase
      .from("products")
      .select("id, name, slug, status, product_images(url)")
      .eq("store_id", storeId)
      .eq("id", parsedId.data)
      .maybeSingle();
    if (!p) return fail("El producto ya no existe.");
    if (p.status !== "archived") return fail("Archivalo primero: sólo se pueden eliminar productos archivados.");
    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("product_id", p.id);
    if (count) return fail("Este producto tiene pedidos. Dejalo archivado para conservar el historial.");

    const urls = (p.product_images ?? []).map((i) => i.url);

    // Quitarlo de los relacionados de otros productos.
    const { data: referencing } = await supabase
      .from("products")
      .select("id, related_ids")
      .eq("store_id", storeId)
      .contains("related_ids", [p.id]);
    for (const r of referencing ?? []) {
      await supabase
        .from("products")
        .update({ related_ids: (r.related_ids ?? []).filter((x) => x !== p.id) })
        .eq("store_id", storeId)
        .eq("id", r.id);
    }

    const { error } = await supabase.from("products").delete().eq("store_id", storeId).eq("id", p.id);
    if (error) throw new Error(error.message);

    // Las redirecciones que apuntaban a este producto quedarían rotas.
    await supabase.from("redirects").delete().eq("store_id", storeId).eq("to_path", `/producto/${p.slug}`);

    await removeMediaIfUnused(ctx, urls);
    // Archivos sueltos de la carpeta del producto.
    const folder = mediaPath(storeId, "products", p.id);
    const { data: files } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 1000 });
    if (files?.length) await supabase.storage.from(MEDIA_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));

    await logAudit(ctx, {
      action: "product.delete",
      entity: "product",
      entityId: p.id,
      summary: `Eliminó definitivamente ${p.name}`,
    });
    revalidateProducts(storeId, [p.slug], true);
    return ok({ id: p.id });
  });
}

// ---------------------------------------------------------------------------
// Imágenes (los archivos se suben desde el navegador; acá se registran)
// ---------------------------------------------------------------------------

export async function addProductImages(input: unknown): Promise<ActionResult<{ images: AdminImage[] }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = addImagesSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { productId, images } = parsed.data;
    const { supabase } = ctx;
    const storeId = ctx.store.id;

    for (const img of images) {
      if (!isStoreMediaPath(img.path, storeId, "products", productId) || storagePathFromUrl(img.url) !== img.path) {
        return fail("La imagen no corresponde a este producto.");
      }
    }
    const { data: p } = await supabase
      .from("products")
      .select("id, slug, name")
      .eq("store_id", storeId)
      .eq("id", productId)
      .maybeSingle();
    if (!p) return fail("El producto ya no existe.");
    await assertProductImages(ctx, productId, images.length);
    const { data: last } = await supabase
      .from("product_images")
      .select("position")
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .order("position", { ascending: false })
      .limit(1);
    const start = (last?.[0]?.position ?? -1) + 1;
    const { data: inserted, error } = await supabase
      .from("product_images")
      .insert(
        images.map((img, i) => ({
          store_id: storeId,
          product_id: productId,
          url: img.url,
          alt: img.alt ?? null,
          width: img.width ?? null,
          height: img.height ?? null,
          position: start + i,
        })),
      )
      .select("id, url, alt, position, width, height");
    if (error) throw new Error(error.message);

    await logAudit(ctx, {
      action: "product.images_add",
      entity: "product",
      entityId: productId,
      summary: `Subió ${images.length} imagen${images.length === 1 ? "" : "es"} a ${p.name}`,
    });
    revalidateProducts(storeId, [p.slug]);
    return ok({ images: inserted ?? [] });
  });
}

export async function deleteProductImage(imageId: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!idSchema.safeParse(imageId).success) return fail("Imagen inválida.");
    const { data: img } = await ctx.supabase
      .from("product_images")
      .select("id, url, product_id, products(slug, name)")
      .eq("store_id", ctx.store.id)
      .eq("id", imageId)
      .maybeSingle();
    if (!img) return ok({ id: imageId });
    const { error } = await ctx.supabase.from("product_images").delete().eq("store_id", ctx.store.id).eq("id", img.id);
    if (error) throw new Error(error.message);
    await removeMediaIfUnused(ctx, [img.url]);
    await logAudit(ctx, {
      action: "product.images_delete",
      entity: "product",
      entityId: img.product_id,
      summary: `Borró una imagen de ${img.products?.name ?? "un producto"}`,
    });
    revalidateProducts(ctx.store.id, [img.products?.slug]);
    return ok({ id: img.id });
  });
}

export async function reorderProductImages(productId: string, ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = z.object({ productId: z.string().uuid(), ids: z.array(z.string().uuid()).max(100) }).safeParse({ productId, ids });
    if (!parsed.success) return zodFail(parsed.error);
    const results = await Promise.all(
      parsed.data.ids.map((id, position) =>
        ctx.supabase
          .from("product_images")
          .update({ position })
          .eq("store_id", ctx.store.id)
          .eq("id", id)
          .eq("product_id", parsed.data.productId),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    const { data: p } = await ctx.supabase
      .from("products")
      .select("slug")
      .eq("store_id", ctx.store.id)
      .eq("id", parsed.data.productId)
      .maybeSingle();
    revalidateProducts(ctx.store.id, [p?.slug]);
    return ok();
  });
}

export async function updateImageAlt(imageId: string, alt: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = z.object({ id: z.string().uuid(), alt: z.string().trim().max(200, "Hasta 200 caracteres.") }).safeParse({ id: imageId, alt });
    if (!parsed.success) return zodFail(parsed.error, parsed.error.issues[0]?.message);
    const { data, error } = await ctx.supabase
      .from("product_images")
      .update({ alt: parsed.data.alt || null })
      .eq("store_id", ctx.store.id)
      .eq("id", parsed.data.id)
      .select("products(slug)")
      .maybeSingle();
    if (error) throw new Error(error.message);
    revalidateProducts(ctx.store.id, [data?.products?.slug]);
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Pickers (búsqueda de productos, ficha técnica de otro producto)
// ---------------------------------------------------------------------------

export async function searchProducts(q: string, excludeIds: string[] = []): Promise<ActionResult<{ items: ProductSummary[] }>> {
  return runAction(async () => {
    const { supabase, store } = await requireAdmin();
    let query = catalogDb(supabase)
      .from("admin_products")
      .select("id, name, slug, status, image_url, skus")
      .eq("store_id", store.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    const term = searchTerm(String(q ?? "").slice(0, 100));
    if (term) {
      const like = `*${term}*`;
      query = query.or(`name.ilike."${like}",skus.ilike."${like}",brand.ilike."${like}"`);
    }
    const exclude = excludeIds.filter((id) => idSchema.safeParse(id).success).slice(0, 50);
    if (exclude.length) query = query.not("id", "in", `(${exclude.join(",")})`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ok({
      items: (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        image_url: p.image_url,
        sku: p.skus.trim().split(/\s+/)[0] || null,
      })),
    });
  });
}

export async function getProductSpecs(id: string): Promise<ActionResult<{ specs: SpecRow[]; name: string }>> {
  return runAction(async () => {
    await requireAdmin();
    if (!idSchema.safeParse(id).success) return fail("Producto inválido.");
    const product = await getAdminProduct(id);
    if (!product) return fail("El producto ya no existe.");
    return ok({ specs: product.specs, name: product.name });
  });
}

/** Slug sugerido para un nombre (libre en la tabla). */
export async function suggestProductSlug(name: string, exceptId?: string | null): Promise<ActionResult<{ slug: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const base = slugify(String(name ?? "")) || "producto";
    return ok({ slug: await uniqueSlug(base, (s) => slugTaken(ctx, s, exceptId ?? null)) });
  });
}
