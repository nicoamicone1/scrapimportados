"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { idSchema, productSpecSchema } from "@/components/admin/print3d/config/schemas";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { requireModule } from "@/lib/modules/server";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Productos del catálogo que se imprimen (agente D1, TALLER-3D §5): la
 * ficha de impresión (material, gramos, minutos…) sirve para costear y,
 * si es "a pedido", para la fecha estimada en la tienda → tag `print3d:<id>`.
 */

const PATH = "/admin/taller-3d/productos";

function revalidate(ctx: AdminContext) {
  revalidateTag(`print3d:${ctx.store.id}`, "max");
  revalidatePath(PATH);
}

async function print3dCtx() {
  const ctx = await requireAdmin();
  requireModule(ctx, "print3d");
  return ctx;
}

export interface SpecVariantOption {
  id: string;
  title: string;
  price: number;
}

/** Variantes de un producto para elegir a cuál aplica la ficha. */
export async function listSpecVariants(productId: unknown): Promise<ActionResult<{ variants: SpecVariantOption[] }>> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const pid = idSchema.safeParse(productId);
    if (!pid.success) return fail("Producto inválido.");
    const { data, error } = await ctx.supabase
      .from("product_variants")
      .select("id, title, price, position")
      .eq("store_id", ctx.store.id)
      .eq("product_id", pid.data)
      .order("position");
    if (error) throw new Error(error.message);
    return ok({ variants: (data ?? []).map((v) => ({ id: v.id, title: v.title, price: Number(v.price) })) });
  });
}

const DUPLICATE = "Ese producto (o esa variante) ya tiene una ficha de impresión.";

export async function saveProductSpec(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const parsed = productSpecSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { id, ...row } = parsed.data;

    // Todo lo referenciado tiene que ser de esta tienda.
    const [product, variant, material, color, quality] = await Promise.all([
      ctx.supabase.from("products").select("id, name").eq("store_id", ctx.store.id).eq("id", row.product_id).maybeSingle(),
      row.variant_id
        ? ctx.supabase
            .from("product_variants")
            .select("id")
            .eq("store_id", ctx.store.id)
            .eq("product_id", row.product_id)
            .eq("id", row.variant_id)
            .maybeSingle()
        : Promise.resolve({ data: { id: null } }),
      ctx.supabase.from("print3d_materials").select("id").eq("store_id", ctx.store.id).eq("id", row.material_id).maybeSingle(),
      row.color_id
        ? ctx.supabase
            .from("print3d_colors")
            .select("id")
            .eq("store_id", ctx.store.id)
            .eq("material_id", row.material_id)
            .eq("id", row.color_id)
            .maybeSingle()
        : Promise.resolve({ data: { id: null } }),
      ctx.supabase.from("print3d_qualities").select("id").eq("store_id", ctx.store.id).eq("id", row.quality_id).maybeSingle(),
    ]);
    if (!product.data) return fail("El producto ya no existe.", { product_id: ["Elegí un producto."] });
    if (!variant.data) return fail("Esa variante no es de este producto.", { variant_id: ["Elegí una variante."] });
    if (!material.data) return fail("Ese material ya no existe.", { material_id: ["Elegí un material."] });
    if (!color.data) return fail("Ese color no es de este material.", { color_id: ["Elegí un color del material."] });
    if (!quality.data) return fail("Esa calidad ya no existe.", { quality_id: ["Elegí una calidad."] });

    if (!id) {
      const { data, error } = await ctx.supabase
        .from("print3d_product_specs")
        .insert({ ...row, store_id: ctx.store.id })
        .select("id")
        .single();
      if (error?.code === "23505") return fail(DUPLICATE, { variant_id: [DUPLICATE] });
      if (error || !data) {
        console.error("[taller-3d] spec insert", error?.message);
        return fail("No se pudo guardar la ficha. Probá de nuevo.");
      }
      await logAudit(ctx, {
        action: "print3d.spec.create",
        entity: "print3d_product_spec",
        entityId: data.id,
        summary: `Cargó la ficha de impresión de ${product.data.name}`,
        diff: row as unknown as Json,
      });
      revalidate(ctx);
      return ok({ id: data.id });
    }

    const { data: before } = await ctx.supabase
      .from("print3d_product_specs")
      .select("*")
      .eq("store_id", ctx.store.id)
      .eq("id", id)
      .maybeSingle();
    if (!before) return fail("La ficha ya no existe.");
    const { error } = await ctx.supabase.from("print3d_product_specs").update(row).eq("store_id", ctx.store.id).eq("id", id);
    if (error?.code === "23505") return fail(DUPLICATE, { variant_id: [DUPLICATE] });
    if (error) {
      console.error("[taller-3d] spec update", error.message);
      return fail("No se pudo guardar la ficha. Probá de nuevo.");
    }
    const beforeSubset = Object.fromEntries(Object.keys(row).map((k) => [k, before[k as keyof typeof before] as Json]));
    await logAudit(ctx, {
      action: "print3d.spec.update",
      entity: "print3d_product_spec",
      entityId: id,
      summary: `Editó la ficha de impresión de ${product.data.name}`,
      diff: shallowDiff(beforeSubset, row as unknown as Record<string, Json>),
    });
    revalidate(ctx);
    return ok({ id });
  });
}

export async function deleteProductSpec(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const sid = idSchema.safeParse(id);
    if (!sid.success) return fail("Ficha inválida.");
    const { data: spec } = await ctx.supabase
      .from("print3d_product_specs")
      .select("*")
      .eq("store_id", ctx.store.id)
      .eq("id", sid.data)
      .maybeSingle();
    if (!spec) return fail("La ficha ya no existe.");
    const { error } = await ctx.supabase.from("print3d_product_specs").delete().eq("store_id", ctx.store.id).eq("id", spec.id);
    if (error) return fail("No se pudo borrar la ficha. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.spec.delete",
      entity: "print3d_product_spec",
      entityId: spec.id,
      summary: "Borró una ficha de impresión",
      diff: spec as unknown as Json,
    });
    revalidate(ctx);
    return ok();
  });
}
