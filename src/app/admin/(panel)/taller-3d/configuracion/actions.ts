"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { SEED_MATERIALS, SEED_PRINTER, SEED_QUALITIES } from "@/components/admin/print3d/config/defaults";
import { calibrationKeySchema, idSchema, workshopConfigSchema } from "@/components/admin/print3d/config/schemas";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { requireModule } from "@/lib/modules/server";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Configuración del Taller 3D (agente D1, TALLER-3D §5): precios,
 * calendario, costos, cotizador, calidades y calibración. También vive acá
 * `seedPrint3dDefaults` ("Cargar valores de ejemplo", idempotente).
 */

const PATH = "/admin/taller-3d/configuracion";

function revalidate(ctx: AdminContext, extra: string[] = []) {
  revalidateTag(`print3d:${ctx.store.id}`, "max");
  revalidatePath(PATH);
  revalidatePath("/admin/taller-3d");
  for (const p of extra) revalidatePath(p);
}

async function print3dCtx() {
  const ctx = await requireAdmin();
  requireModule(ctx, "print3d");
  return ctx;
}

/** Guarda settings + calidades de una (una sola barra de guardado en la página). */
export async function saveWorkshopConfig(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const parsed = workshopConfigSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { settings, qualities } = parsed.data;

    const { error: sErr } = await ctx.supabase
      .from("print3d_settings")
      .upsert({ ...settings, store_id: ctx.store.id }, { onConflict: "store_id" });
    if (sErr) {
      console.error("[taller-3d] settings upsert", sErr.message);
      return fail("No se pudo guardar la configuración. Probá de nuevo.");
    }

    const { data: existing } = await ctx.supabase.from("print3d_qualities").select("id").eq("store_id", ctx.store.id);
    const known = new Set((existing ?? []).map((q) => q.id));
    for (const [position, q] of qualities.entries()) {
      const { id, ...row } = q;
      const values = { ...row, position };
      const res =
        id && known.has(id)
          ? await ctx.supabase.from("print3d_qualities").update(values).eq("store_id", ctx.store.id).eq("id", id)
          : await ctx.supabase.from("print3d_qualities").insert({ ...values, store_id: ctx.store.id });
      if (res.error?.code === "23505") {
        const msg = "Ya hay otra calidad con ese código.";
        return fail(msg, { [`qualities.${position}.name`]: [msg] });
      }
      if (res.error) {
        console.error("[taller-3d] quality save", res.error.message);
        return fail(`No se pudo guardar la calidad ${q.name}. Probá de nuevo.`);
      }
    }

    await logAudit(ctx, {
      action: "print3d.settings.update",
      entity: "print3d_settings",
      entityId: ctx.store.id,
      summary: `Actualizó la configuración del taller (${qualities.length} ${qualities.length === 1 ? "calidad" : "calidades"})`,
      diff: parsed.data as unknown as Json,
    });
    revalidate(ctx);
    return ok();
  });
}

export async function deleteQuality(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const qid = idSchema.safeParse(id);
    if (!qid.success) return fail("Calidad inválida.");
    const { data: quality } = await ctx.supabase
      .from("print3d_qualities")
      .select("id, name")
      .eq("store_id", ctx.store.id)
      .eq("id", qid.data)
      .maybeSingle();
    if (!quality) return fail("La calidad ya no existe.");

    const refs = await Promise.all(
      (["print3d_jobs", "print3d_product_specs", "print3d_quote_items"] as const).map(async (table) => {
        const { count } = await ctx.supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("store_id", ctx.store.id)
          .eq("quality_id", quality.id);
        return count ?? 0;
      }),
    );
    if (refs.some((c) => c > 0)) {
      return fail(`«${quality.name}» ya se usó en trabajos, cotizaciones o productos: desactivala en lugar de borrarla.`);
    }
    await ctx.supabase.from("print3d_calibration").delete().eq("store_id", ctx.store.id).eq("quality_id", quality.id);
    const { error } = await ctx.supabase.from("print3d_qualities").delete().eq("store_id", ctx.store.id).eq("id", quality.id);
    if (error) return fail("No se pudo borrar la calidad. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.quality.delete",
      entity: "print3d_quality",
      entityId: quality.id,
      summary: `Borró la calidad ${quality.name}`,
    });
    revalidate(ctx);
    return ok();
  });
}

/** Resetea la calibración de un par material × calidad, o toda si `input` es null. */
export async function resetCalibration(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    let query = ctx.supabase.from("print3d_calibration").delete().eq("store_id", ctx.store.id);
    let summary = "Reseteó toda la calibración del taller";
    if (input !== null && input !== undefined) {
      const key = calibrationKeySchema.safeParse(input);
      if (!key.success) return fail("Calibración inválida.");
      query = query.eq("material_id", key.data.material_id).eq("quality_id", key.data.quality_id);
      summary = "Reseteó la calibración de un material × calidad";
    }
    const { error } = await query;
    if (error) return fail("No se pudo resetear la calibración. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.calibration.reset",
      entity: "print3d_calibration",
      summary,
      diff: (input ?? null) as Json,
    });
    revalidate(ctx);
    return ok();
  });
}

export interface SeedResult {
  qualities: number;
  materials: number;
  colors: number;
  printers: number;
}

/**
 * "Cargar valores de ejemplo" (TALLER-3D §5). Idempotente: sólo agrega lo
 * que falta (calidades por código, materiales por tipo+nombre, colores por
 * nombre, la A1 sólo si no hay impresoras) y nunca pisa lo que ya editaste.
 */
export async function seedPrint3dDefaults(): Promise<ActionResult<SeedResult>> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const storeId = ctx.store.id;
    const result: SeedResult = { qualities: 0, materials: 0, colors: 0, printers: 0 };

    const { error: sErr } = await ctx.supabase
      .from("print3d_settings")
      .upsert({ store_id: storeId }, { onConflict: "store_id", ignoreDuplicates: true });
    if (sErr) {
      console.error("[taller-3d] seed settings", sErr.message);
      return fail("No se pudieron cargar los valores de ejemplo. Probá de nuevo.");
    }

    // Calidades
    const { data: qRows } = await ctx.supabase.from("print3d_qualities").select("code, position").eq("store_id", storeId);
    const qCodes = new Set((qRows ?? []).map((q) => q.code));
    let qPos = (qRows ?? []).reduce((max, q) => Math.max(max, (q.position ?? 0) + 1), 0);
    const newQualities = SEED_QUALITIES.filter((q) => !qCodes.has(q.code)).map((q) => ({ ...q, store_id: storeId, position: qPos++ }));
    if (newQualities.length) {
      const { error } = await ctx.supabase.from("print3d_qualities").insert(newQualities);
      if (error) {
        console.error("[taller-3d] seed qualities", error.message);
        return fail("No se pudieron cargar las calidades de ejemplo.");
      }
      result.qualities = newQualities.length;
    }

    // Materiales y colores
    const { data: mRows } = await ctx.supabase.from("print3d_materials").select("id, type, name, position").eq("store_id", storeId);
    let mPos = (mRows ?? []).reduce((max, m) => Math.max(max, (m.position ?? 0) + 1), 0);
    for (const seed of SEED_MATERIALS) {
      const found = (mRows ?? []).find((m) => m.type === seed.type && m.name.trim().toLowerCase() === seed.name.toLowerCase());
      let materialId = found?.id;
      if (!materialId) {
        const material = {
          type: seed.type,
          name: seed.name,
          brand: seed.brand,
          density: seed.density,
          price_per_gram: seed.price_per_gram,
          speed_factor: seed.speed_factor,
        };
        const { data, error } = await ctx.supabase
          .from("print3d_materials")
          .insert({ ...material, store_id: storeId, position: mPos++, is_active: true })
          .select("id")
          .single();
        if (error || !data) {
          console.error("[taller-3d] seed material", error?.message);
          return fail(`No se pudo cargar el material ${seed.name}.`);
        }
        materialId = data.id;
        result.materials++;
      }
      const { data: cRows } = await ctx.supabase
        .from("print3d_colors")
        .select("name, position")
        .eq("store_id", storeId)
        .eq("material_id", materialId);
      const cNames = new Set((cRows ?? []).map((c) => c.name.trim().toLowerCase()));
      let cPos = (cRows ?? []).reduce((max, c) => Math.max(max, (c.position ?? 0) + 1), 0);
      const newColors = seed.colors
        .filter((c) => !cNames.has(c.name.toLowerCase()))
        .map((c) => ({ ...c, store_id: storeId, material_id: materialId, is_active: true, position: cPos++ }));
      if (newColors.length) {
        const { error } = await ctx.supabase.from("print3d_colors").insert(newColors);
        if (error) {
          console.error("[taller-3d] seed colors", error.message);
          return fail(`No se pudieron cargar los colores de ${seed.name}.`);
        }
        result.colors += newColors.length;
      }
    }

    // Impresora (sólo si no hay ninguna)
    const { count } = await ctx.supabase.from("print3d_printers").select("id", { count: "exact", head: true }).eq("store_id", storeId);
    if ((count ?? 0) === 0) {
      const { error } = await ctx.supabase.from("print3d_printers").insert({ ...SEED_PRINTER, store_id: storeId, position: 0 });
      if (error) {
        console.error("[taller-3d] seed printer", error.message);
        return fail("No se pudo cargar la impresora de ejemplo.");
      }
      result.printers = 1;
    }

    const total = result.qualities + result.materials + result.colors + result.printers;
    if (total > 0) {
      await logAudit(ctx, {
        action: "print3d.seed",
        entity: "print3d_settings",
        entityId: storeId,
        summary: `Cargó valores de ejemplo del taller (${result.qualities} calidades, ${result.materials} materiales, ${result.colors} colores, ${result.printers} impresoras)`,
        diff: result as unknown as Json,
      });
    }
    revalidate(ctx, ["/admin/taller-3d/impresoras", "/admin/taller-3d/filamento"]);
    return ok(result);
  });
}
