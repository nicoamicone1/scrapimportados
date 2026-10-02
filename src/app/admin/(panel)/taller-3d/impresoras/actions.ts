"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { PRINTER_STATUS_LABELS, PRINTER_STATUSES } from "@/components/admin/print3d/config/presets";
import { idSchema, printerSchema } from "@/components/admin/print3d/config/schemas";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit, shallowDiff } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { requireModule } from "@/lib/modules/server";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Impresoras del Taller 3D (agente D1, TALLER-3D §5). Cambian la
 * capacidad y la cama que usa el cotizador público → tag `print3d:<id>`.
 */

const PATH = "/admin/taller-3d/impresoras";

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

async function loadPrinter(ctx: AdminContext, id: unknown) {
  const pid = idSchema.safeParse(id);
  if (!pid.success) return null;
  const { data } = await ctx.supabase.from("print3d_printers").select("*").eq("store_id", ctx.store.id).eq("id", pid.data).maybeSingle();
  return data;
}

export async function savePrinter(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const parsed = printerSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const row = parsed.data;

    if (id === null || id === undefined) {
      const { count } = await ctx.supabase.from("print3d_printers").select("id", { count: "exact", head: true }).eq("store_id", ctx.store.id);
      const { data, error } = await ctx.supabase
        .from("print3d_printers")
        .insert({ ...row, store_id: ctx.store.id, position: count ?? 0 })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[taller-3d] printer insert", error?.message);
        return fail("No se pudo agregar la impresora. Probá de nuevo.");
      }
      await logAudit(ctx, {
        action: "print3d.printer.create",
        entity: "print3d_printer",
        entityId: data.id,
        summary: `Agregó la impresora ${row.name}`,
        diff: row as unknown as Json,
      });
      revalidate(ctx);
      return ok({ id: data.id });
    }

    const before = await loadPrinter(ctx, id);
    if (!before) return fail("La impresora ya no existe.");
    const { error } = await ctx.supabase.from("print3d_printers").update(row).eq("store_id", ctx.store.id).eq("id", before.id);
    if (error) {
      console.error("[taller-3d] printer update", error.message);
      return fail("No se pudo guardar la impresora. Probá de nuevo.");
    }
    const beforeSubset = Object.fromEntries(Object.keys(row).map((k) => [k, before[k as keyof typeof before] as Json]));
    await logAudit(ctx, {
      action: "print3d.printer.update",
      entity: "print3d_printer",
      entityId: before.id,
      summary: `Editó la impresora ${row.name}`,
      diff: shallowDiff(beforeSubset, row as unknown as Record<string, Json>),
    });
    revalidate(ctx);
    return ok({ id: before.id });
  });
}

const statusSchema = z.enum(PRINTER_STATUSES);

export async function setPrinterStatus(id: unknown, status: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const next = statusSchema.safeParse(status);
    if (!next.success) return fail("Estado inválido.");
    const printer = await loadPrinter(ctx, id);
    if (!printer) return fail("La impresora ya no existe.");
    if (printer.status === next.data) return ok();
    const { error } = await ctx.supabase
      .from("print3d_printers")
      .update({ status: next.data })
      .eq("store_id", ctx.store.id)
      .eq("id", printer.id);
    if (error) return fail("No se pudo cambiar el estado. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.printer.status",
      entity: "print3d_printer",
      entityId: printer.id,
      summary: `Pasó ${printer.name} a ${PRINTER_STATUS_LABELS[next.data].toLowerCase()}`,
      diff: { status: [printer.status, next.data] },
    });
    revalidate(ctx);
    return ok();
  });
}

export async function deletePrinter(id: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await print3dCtx();
    const printer = await loadPrinter(ctx, id);
    if (!printer) return fail("La impresora ya no existe.");
    const { count } = await ctx.supabase
      .from("print3d_jobs")
      .select("id", { count: "exact", head: true })
      .eq("store_id", ctx.store.id)
      .eq("printer_id", printer.id);
    if ((count ?? 0) > 0) {
      return fail("Esta impresora tiene trabajos en su historial: pasala a Inactiva en lugar de borrarla.");
    }
    const { error } = await ctx.supabase.from("print3d_printers").delete().eq("store_id", ctx.store.id).eq("id", printer.id);
    if (error) return fail("No se pudo borrar la impresora. Probá de nuevo.");
    await logAudit(ctx, {
      action: "print3d.printer.delete",
      entity: "print3d_printer",
      entityId: printer.id,
      summary: `Borró la impresora ${printer.name}`,
      diff: printer as unknown as Json,
    });
    revalidate(ctx);
    return ok();
  });
}
