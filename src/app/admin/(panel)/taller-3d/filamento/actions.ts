"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { addSpoolsSchema, adjustSpoolSchema, idSchema, materialSchema } from "@/components/admin/print3d/config/schemas";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { formatNumber } from "@/lib/money";
import { requireModule } from "@/lib/modules/server";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Filamento del Taller 3D (agente D1, TALLER-3D §5): materiales con sus
 * colores y el estante de bobinas. Precios y stock alimentan el cotizador
 * público (disponibilidad por color) → tag `print3d:<id>`.
 * No se borra nada que usen trabajos, cotizaciones o fichas de producto:
 * se archiva (`is_active = false`) o se marca vacía.
 */

const PATH = "/admin/taller-3d/filamento";

function revalidate(ctx: AdminContext) {
  revalidateTag(`print3d:${ctx.store.id}`, "max");
  revalidatePath(PATH);
  revalidatePath("/admin/taller-3d");
}

async function print3dCtx() {
  const ctx = await requireAdmin();
  requireModule(ctx, "print3d");
  return ctx;
}

type RefTable = "print3d_quote_items" | "print3d_jobs" | "print3d_product_specs" | "print3d_spools";

/** Cuántas filas de `table` apuntan a `id` por `column` (dentro de la tienda). */
async function countRefs(ctx: AdminContext, table: RefTable, column: "material_id" | "color_id" | "spool_id", ids: string[]) {
  if (!ids.length) return 0;
  if (table === "print3d_quote_items") {
    // Los ítems no tienen store_id: se filtran por su cotización.
    const { count } = await ctx.supabase
      .from("print3d_quote_items")
      .select("id, print3d_quotes!inner(store_id)", { count: "exact", head: true })
      .eq("print3d_quotes.store_id", ctx.store.id)
      .in(column as "material_id" | "color_id", ids);
    return count ?? 0;
  }
  const { count } = await ctx.supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("store_id", ctx.store.id)
    .in(column, ids);
  return count ?? 0;
}

/* ─────────────────────────── Materiales ─────────────────────────── */

async function loadMaterial(ctx: AdminContext, id: unknown) {
  const mid = idSchema.safeParse(id);
  if (!mid.success) return null;
  const { data } = await ctx.supabase.from("print3d_materials").select("*").eq("store_id", ctx.store.id).eq("id", mid.data).maybeSingle();
  return data;
}

export async function saveMaterial(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { colors, ...row } = parsed.data;

    let materialId: string;
    if (id === null || id === undefined) {
      const { count } = await ctx.supabase.from("print3d_materials").select("id", { count: "exact", head: true }).eq("store_id", ctx.store.id);
      const { data, error } = await ctx.supabase
        .from("print3d_materials")
        .insert({ ...row, store_id: ctx.store.id, position: count ?? 0 })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[taller-3d] material insert", error?.message);
        return fail("No se pudo crear el material. Probá de nuevo.");
      }
      materialId = data.id;
      await logAudit(ctx, {
        action: "print3d.material.create",
        entity: "print3d_material",
        entityId: materialId,
        summary: `Creó el material ${row.name} con ${colors.length} ${colors.length === 1 ? "color" : "colores"}`,
        diff: parsed.data as unknown as Json,
      });
    } else {
      const before = await loadMaterial(ctx, id);
      if (!before) return fail("El material ya no existe.");
      materialId = before.id;
      const { error } = await ctx.supabase.from("print3d_materials").update(row).eq("store_id", ctx.store.id).eq("id", materialId);
      if (error) {
        console.error("[taller-3d] material update", error.message);
        return fail("No se pudo guardar el material. Probá de nuevo.");
      }
      const beforeSubset = Object.fromEntries(Object.keys(row).map((k) => [k, before[k as keyof typeof before] as Json]));
      await logAudit(ctx, {
        action: "print3d.material.update",
        entity: "print3d_material",
        entityId: materialId,
        summary: `Editó el material ${row.name}`,
        diff: shallowDiff(beforeSubset, row as unknown as Record<string, Json>),
      });
    }

    // Colores: los existentes se actualizan, los nuevos se insertan. Borrar es `deleteColor`.
    const { data: existing } = await ctx.supabase
      .from("print3d_colors")
      .select("id")
      .eq("store_id", ctx.store.id)
      .eq("material_id", materialId);
    const known = new Set((existing ?? []).map((c) => c.id));
    const inserts: { store_id: string; material_id: string; name: string; hex: string; is_active: boolean; position: number }[] = [];
    for (const [position, c] of colors.entries()) {
      if (c.id && known.has(c.id)) {
        const { error } = await ctx.supabase
          .from("print3d_colors")
          .update({ name: c.name, hex: c.hex, is_active: c.is_active, position })
          .eq("store_id", ctx.store.id)
          .eq("id", c.id);
        if (error) return fail(`No se pudo guardar el color ${c.name}. Probá de nuevo.`);
      } else {
        inserts.push({ store_id: ctx.store.id, material_id: materialId, name: c.name, hex: c.hex, is_active: c.is_active, position });
      }
    }
    if (inserts.length) {
      const { error } = await ctx.supabase.from("print3d_colors").insert(inserts);
      if (error) {
        console.error("[taller-3d] colors insert", error.message);
        return fail("Se guardó el material pero no los colores nuevos. Probá de nuevo.");
      }
    }

    revalidate(ctx);
    return ok({ id: materialId });
  });
}

export async function setMaterialActive(id: unknown, active: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const material = await loadMaterial(ctx, id);
    if (!material) return fail("El material ya no existe.");
    const next = active === true;
    const { error } = await ctx.supabase
      .from("print3d_materials")
      .update({ is_active: next })
      .eq("store_id", ctx.store.id)
      .eq("id", material.id);
    if (error) return fail("No se pudo actualizar. Probá de nuevo.");
    await logAudit(ctx, {
      action: next ? "print3d.material.activate" : "print3d.material.archive",
      entity: "print3d_material",
      entityId: material.id,
      summary: `${next ? "Reactivó" : "Archivó"} el material ${material.name}`,
    });
    revalidate(ctx);
    return ok();
  });
}

export async function deleteMaterial(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const material = await loadMaterial(ctx, id);
    if (!material) return fail("El material ya no existe.");
    const { data: colors } = await ctx.supabase
      .from("print3d_colors")
      .select("id")
      .eq("store_id", ctx.store.id)
      .eq("material_id", material.id);
    const colorIds = (colors ?? []).map((c) => c.id);
    const [quotes, jobs, specs, spools] = await Promise.all([
      countRefs(ctx, "print3d_quote_items", "material_id", [material.id]),
      countRefs(ctx, "print3d_jobs", "material_id", [material.id]),
      countRefs(ctx, "print3d_product_specs", "material_id", [material.id]),
      countRefs(ctx, "print3d_spools", "color_id", colorIds),
    ]);
    if (quotes + jobs > 0) {
      return fail("Este material ya se usó en cotizaciones o trabajos: archivalo para que no se ofrezca más.");
    }
    if (specs > 0) return fail("Hay productos del catálogo que se imprimen con este material: cambiales la ficha primero.");
    if (spools > 0) return fail("Todavía tiene bobinas en el estante: borralas o archivá el material.");

    await ctx.supabase.from("print3d_calibration").delete().eq("store_id", ctx.store.id).eq("material_id", material.id);
    const { error } = await ctx.supabase.from("print3d_materials").delete().eq("store_id", ctx.store.id).eq("id", material.id);
    if (error) {
      console.error("[taller-3d] material delete", error.message);
      return fail("No se pudo borrar el material. Probá de nuevo.");
    }
    await logAudit(ctx, {
      action: "print3d.material.delete",
      entity: "print3d_material",
      entityId: material.id,
      summary: `Borró el material ${material.name}`,
      diff: material as unknown as Json,
    });
    revalidate(ctx);
    return ok();
  });
}

export async function deleteColor(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const cid = idSchema.safeParse(id);
    if (!cid.success) return fail("Color inválido.");
    const { data: color } = await ctx.supabase
      .from("print3d_colors")
      .select("id, name, material_id")
      .eq("store_id", ctx.store.id)
      .eq("id", cid.data)
      .maybeSingle();
    if (!color) return fail("El color ya no existe.");
    const [quotes, jobs, specs, spools] = await Promise.all([
      countRefs(ctx, "print3d_quote_items", "color_id", [color.id]),
      countRefs(ctx, "print3d_jobs", "color_id", [color.id]),
      countRefs(ctx, "print3d_product_specs", "color_id", [color.id]),
      countRefs(ctx, "print3d_spools", "color_id", [color.id]),
    ]);
    if (quotes + jobs + specs > 0) {
      return fail(`El ${color.name} ya se usó en trabajos, cotizaciones o productos: desactivalo en lugar de borrarlo.`);
    }
    if (spools > 0) return fail(`El ${color.name} tiene bobinas cargadas: borralas primero o desactivá el color.`);
    const { error } = await ctx.supabase.from("print3d_colors").delete().eq("store_id", ctx.store.id).eq("id", color.id);
    if (error) return fail("No se pudo borrar el color. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.color.delete",
      entity: "print3d_color",
      entityId: color.id,
      summary: `Borró el color ${color.name}`,
    });
    revalidate(ctx);
    return ok();
  });
}

/* ─────────────────────────── Bobinas ─────────────────────────── */

export async function addSpools(input: unknown): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const parsed = addSpoolsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const { data: color } = await ctx.supabase
      .from("print3d_colors")
      .select("id, name, material_id")
      .eq("store_id", ctx.store.id)
      .eq("id", v.color_id)
      .maybeSingle();
    if (!color) return fail("Ese color ya no existe.", { color_id: ["Elegí un color."] });

    const rows = Array.from({ length: v.count }, () => ({
      store_id: ctx.store.id,
      color_id: color.id,
      brand: v.brand,
      net_grams: v.net_grams,
      remaining_grams: v.net_grams,
      cost: v.cost,
      status: "sealed" as const,
      purchased_at: v.purchased_at,
      notes: v.notes,
    }));
    const { error } = await ctx.supabase.from("print3d_spools").insert(rows);
    if (error) {
      console.error("[taller-3d] spools insert", error.message);
      return fail("No se pudieron cargar las bobinas. Probá de nuevo.");
    }
    await logAudit(ctx, {
      action: "print3d.spool.add",
      entity: "print3d_color",
      entityId: color.id,
      summary: `Cargó ${v.count} ${v.count === 1 ? "bobina" : "bobinas"} de ${formatNumber(v.net_grams)} g de ${color.name}`,
      diff: v as unknown as Json,
    });
    revalidate(ctx);
    return ok({ count: v.count });
  });
}

async function loadSpool(ctx: AdminContext, id: unknown) {
  const sid = idSchema.safeParse(id);
  if (!sid.success) return null;
  const { data } = await ctx.supabase.from("print3d_spools").select("*").eq("store_id", ctx.store.id).eq("id", sid.data).maybeSingle();
  return data;
}

/** Pesaje: fija los gramos restantes (y costo/marca/nota). El estado se deduce. */
export async function adjustSpool(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const parsed = adjustSpoolSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const spool = await loadSpool(ctx, v.id);
    if (!spool) return fail("La bobina ya no existe.");
    const net = Number(spool.net_grams);
    if (v.remaining_grams > net) {
      const msg = `No puede quedar más que el neto de la bobina (${formatNumber(net)} g).`;
      return fail(msg, { remaining_grams: [msg] });
    }
    const remaining = Math.round(v.remaining_grams * 10) / 10;
    const status = remaining <= 0 ? "empty" : remaining >= net && spool.status === "sealed" ? "sealed" : "open";
    const patch = { remaining_grams: remaining, status, cost: v.cost, brand: v.brand, notes: v.notes };
    const { error } = await ctx.supabase.from("print3d_spools").update(patch).eq("store_id", ctx.store.id).eq("id", spool.id);
    if (error) return fail("No se pudo guardar el pesaje. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.spool.adjust",
      entity: "print3d_spool",
      entityId: spool.id,
      summary: `Ajustó una bobina a ${formatNumber(remaining)} g`,
      diff: shallowDiff(
        { remaining_grams: spool.remaining_grams, status: spool.status, cost: spool.cost, brand: spool.brand, notes: spool.notes },
        patch,
      ),
    });
    revalidate(ctx);
    return ok();
  });
}

export async function markSpoolEmpty(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const spool = await loadSpool(ctx, id);
    if (!spool) return fail("La bobina ya no existe.");
    const { error } = await ctx.supabase
      .from("print3d_spools")
      .update({ remaining_grams: 0, status: "empty" })
      .eq("store_id", ctx.store.id)
      .eq("id", spool.id);
    if (error) return fail("No se pudo marcar como vacía. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.spool.empty",
      entity: "print3d_spool",
      entityId: spool.id,
      summary: `Marcó vacía una bobina (quedaban ${formatNumber(Number(spool.remaining_grams))} g)`,
    });
    revalidate(ctx);
    return ok();
  });
}

export async function deleteSpool(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const spool = await loadSpool(ctx, id);
    if (!spool) return fail("La bobina ya no existe.");
    const used = await countRefs(ctx, "print3d_jobs", "spool_id", [spool.id]);
    if (used > 0) return fail("Esta bobina ya se usó en trabajos: marcala vacía en lugar de borrarla (así queda el costo real).");
    const { error } = await ctx.supabase.from("print3d_spools").delete().eq("store_id", ctx.store.id).eq("id", spool.id);
    if (error) return fail("No se pudo borrar la bobina. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.spool.delete",
      entity: "print3d_spool",
      entityId: spool.id,
      summary: "Borró una bobina",
      diff: spool as unknown as Json,
    });
    revalidate(ctx);
    return ok();
  });
}
