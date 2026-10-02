"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { insertOrderEvent } from "@/lib/admin/order-ops";
import {
  defaultDueDate,
  getWorkshop,
  listBoardJobs,
  listProductSpecs,
  type Workshop,
} from "@/lib/admin/print3d-production";
import {
  ACTIVE_JOB_STATUSES,
  FAILURE_REASONS,
  FAILURE_REASON_LABELS,
  plateJobsForItem,
  remainingMinutes,
  specForItem,
  type JobDraft,
} from "@/lib/admin/print3d-production-utils";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { requireModule } from "@/lib/modules/server";
import { estimateReadyDate } from "@/lib/print3d";

/*
 * Server Actions de la cola de impresión (TALLER-3D §6): requireAdmin →
 * requireModule → zod → escribir (siempre `store_id = ctx.store.id`) →
 * logAudit → revalidar. La cola cambia la fecha de entrega que ve el
 * cliente en el cotizador y en las fichas "a pedido": por eso toda
 * mutación revalida `print3d:<storeId>`.
 */

const uuid = z.string().uuid("Id inválido.");
const grams = z.coerce.number({ invalid_type_error: "Poné un número." }).min(0, "No puede ser negativo.").max(100_000, "Revisá los gramos.");
const minutes = z.coerce.number({ invalid_type_error: "Poné un número." }).min(0, "No puede ser negativo.").max(100_000, "Revisá los minutos.");

async function moduleCtx(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  requireModule(ctx, "print3d");
  return ctx;
}

function revalidateProduction(storeId: string, orderIds: readonly (string | null | undefined)[] = []) {
  revalidateTag(`print3d:${storeId}`, "max");
  revalidatePath("/admin/taller-3d", "layout");
  for (const id of new Set(orderIds)) if (id) revalidatePath(`/admin/pedidos/${id}`);
}

type JobRow = { id: string; title: string; status: string; printer_id: string | null; order_id: string | null; color_id: string | null; spool_id: string | null };

async function loadJob(ctx: AdminContext, id: string): Promise<JobRow | null> {
  const { data } = await ctx.supabase
    .from("print3d_jobs")
    .select("id, title, status, printer_id, order_id, color_id, spool_id")
    .eq("store_id", ctx.store.id)
    .eq("id", id)
    .maybeSingle();
  return data;
}

function isActive(status: string) {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

// ---------------------------------------------------------------------
// Mover / reordenar (drag & drop)
// ---------------------------------------------------------------------

const moveSchema = z.object({
  jobId: uuid,
  /** null = columna "Sin asignar". */
  printerId: uuid.nullable(),
  /** Orden final de la columna destino (incluye el trabajo movido). */
  orderedIds: z.array(uuid).min(1).max(500),
});

export async function moveJob(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { jobId, printerId, orderedIds } = parsed.data;
    if (!orderedIds.includes(jobId)) return fail("El orden no incluye el trabajo movido.");

    if (printerId) {
      const { data: printer } = await ctx.supabase
        .from("print3d_printers")
        .select("id, name, status")
        .eq("store_id", ctx.store.id)
        .eq("id", printerId)
        .maybeSingle();
      if (!printer) return fail("Esa impresora no existe.");
      if (printer.status === "inactive") return fail(`${printer.name} está dada de baja. Activala en Impresoras para cargarle trabajos.`);
    }

    const { data: rows } = await ctx.supabase
      .from("print3d_jobs")
      .select("id, title, status, printer_id, position")
      .eq("store_id", ctx.store.id)
      .in("id", orderedIds);
    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    if (orderedIds.some((id) => !byId.get(id) || !isActive(byId.get(id)!.status))) {
      return fail("La cola cambió mientras movías. Refrescá y probá de nuevo.");
    }
    const moved = byId.get(jobId)!;
    if (moved.printer_id !== printerId && moved.status !== "queued") {
      return fail(moved.status === "printing" ? "Ese trabajo se está imprimiendo: no se puede pasar a otra impresora." : "Sólo se mueven de impresora los trabajos en cola.");
    }

    const updates = orderedIds
      .map((id, position) => ({ id, position, row: byId.get(id)! }))
      .filter(({ row, position }) => row.position !== position || row.printer_id !== printerId);
    const results = await Promise.all(
      updates.map(({ id, position }) =>
        ctx.supabase.from("print3d_jobs").update({ position, printer_id: printerId }).eq("store_id", ctx.store.id).eq("id", id),
      ),
    );
    if (results.some((r) => r.error)) return fail("No se pudo guardar el orden de la cola.");

    if (moved.printer_id !== printerId) {
      await logAudit(ctx, {
        action: "print3d.job.assign",
        entity: "print3d_job",
        entityId: jobId,
        summary: printerId ? `Asignó «${moved.title}» a una impresora` : `Sacó «${moved.title}» de su impresora`,
        diff: { printer_id: [moved.printer_id, printerId] },
      });
    }
    revalidateProduction(ctx.store.id);
    return ok();
  });
}

// ---------------------------------------------------------------------
// Sugerir asignación → aplicar
// ---------------------------------------------------------------------

const assignSchema = z.object({
  assignments: z.array(z.object({ jobId: uuid, printerId: uuid })).min(1, "No hay nada para asignar.").max(500),
});

export async function assignJobs(input: unknown): Promise<ActionResult<{ assigned: number }>> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = assignSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { assignments } = parsed.data;

    const [{ data: printers }, { data: jobs }, { data: columns }] = await Promise.all([
      ctx.supabase.from("print3d_printers").select("id, status").eq("store_id", ctx.store.id),
      ctx.supabase
        .from("print3d_jobs")
        .select("id, status, printer_id")
        .eq("store_id", ctx.store.id)
        .in(
          "id",
          assignments.map((a) => a.jobId),
        ),
      ctx.supabase.from("print3d_jobs").select("printer_id, position").eq("store_id", ctx.store.id).in("status", [...ACTIVE_JOB_STATUSES]),
    ]);
    const okPrinters = new Set((printers ?? []).filter((p) => p.status !== "inactive").map((p) => p.id));
    const free = new Set((jobs ?? []).filter((j) => j.status === "queued" && !j.printer_id).map((j) => j.id));
    const valid = assignments.filter((a) => okPrinters.has(a.printerId) && free.has(a.jobId));
    if (!valid.length) return fail("Esos trabajos ya tienen impresora. Refrescá la cola.");

    // Cada uno al final de su columna, en el orden sugerido.
    const next = new Map<string, number>();
    for (const c of columns ?? []) {
      if (c.printer_id) next.set(c.printer_id, Math.max(next.get(c.printer_id) ?? 0, Number(c.position) + 1));
    }
    const results = await Promise.all(
      valid.map((a) => {
        const position = next.get(a.printerId) ?? 0;
        next.set(a.printerId, position + 1);
        return ctx.supabase
          .from("print3d_jobs")
          .update({ printer_id: a.printerId, position })
          .eq("store_id", ctx.store.id)
          .eq("id", a.jobId)
          .is("printer_id", null);
      }),
    );
    if (results.some((r) => r.error)) return fail("No se pudieron asignar todos los trabajos. Refrescá la cola.");

    await logAudit(ctx, {
      action: "print3d.job.auto_assign",
      entity: "print3d_job",
      summary: `Asignó ${valid.length} ${valid.length === 1 ? "trabajo" : "trabajos"} con la sugerencia`,
      diff: { assignments: valid },
    });
    revalidateProduction(ctx.store.id);
    return ok({ assigned: valid.length });
  });
}

// ---------------------------------------------------------------------
// Empezar
// ---------------------------------------------------------------------

const startSchema = z.object({ jobId: uuid, spoolId: uuid.nullable() });

export async function startJob(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { jobId, spoolId } = parsed.data;

    const job = await loadJob(ctx, jobId);
    if (!job) return fail("El trabajo no existe.");
    if (job.status !== "queued") return fail("Sólo se puede empezar un trabajo que está en cola.");
    if (!job.printer_id) return fail("Asignalo a una impresora antes de empezar.");

    const [{ data: printer }, { data: busy }] = await Promise.all([
      ctx.supabase.from("print3d_printers").select("name, status").eq("store_id", ctx.store.id).eq("id", job.printer_id).maybeSingle(),
      ctx.supabase
        .from("print3d_jobs")
        .select("title")
        .eq("store_id", ctx.store.id)
        .eq("printer_id", job.printer_id)
        .eq("status", "printing")
        .limit(1),
    ]);
    if (!printer) return fail("La impresora de este trabajo ya no existe.");
    if (printer.status !== "active") return fail(`${printer.name} está en ${printer.status === "maintenance" ? "mantenimiento" : "baja"}.`);
    if (busy?.length) return fail(`${printer.name} ya está imprimiendo «${busy[0].title}». Terminalo o marcá que falló.`);

    if (spoolId) {
      const { data: spool } = await ctx.supabase
        .from("print3d_spools")
        .select("id, color_id, status")
        .eq("store_id", ctx.store.id)
        .eq("id", spoolId)
        .maybeSingle();
      if (!spool) return fail("Esa bobina no existe.");
      if (spool.status === "empty") return fail("Esa bobina está marcada como vacía.");
      if (job.color_id && spool.color_id !== job.color_id) return fail("La bobina no es del color de este trabajo.");
    }

    const { error } = await ctx.supabase
      .from("print3d_jobs")
      .update({ status: "printing", started_at: new Date().toISOString(), spool_id: spoolId ?? job.spool_id })
      .eq("store_id", ctx.store.id)
      .eq("id", jobId)
      .eq("status", "queued");
    if (error) return fail("No se pudo empezar el trabajo.");

    await logAudit(ctx, {
      action: "print3d.job.start",
      entity: "print3d_job",
      entityId: jobId,
      summary: `Empezó «${job.title}» en ${printer.name}`,
    });
    revalidateProduction(ctx.store.id, [job.order_id]);
    return ok();
  });
}

// ---------------------------------------------------------------------
// Terminar (RPC print3d_finish_job: descuenta bobina, suma horas, recalibra)
// ---------------------------------------------------------------------

const finishSchema = z.object({
  jobId: uuid,
  actualGrams: grams,
  actualMinutes: minutes.refine((v) => v > 0, "Tiene que ser mayor a 0."),
  spoolId: uuid.nullable(),
  postMinutes: minutes.max(10_000, "Revisá los minutos."),
});

export async function finishJob(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = finishSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const job = await loadJob(ctx, v.jobId);
    if (!job) return fail("El trabajo no existe.");
    if (!isActive(job.status)) return fail("Ese trabajo ya está cerrado.");
    if (v.spoolId) {
      const { data: spool } = await ctx.supabase.from("print3d_spools").select("id").eq("store_id", ctx.store.id).eq("id", v.spoolId).maybeSingle();
      if (!spool) return fail("Esa bobina no existe.");
    }

    const { error } = await ctx.supabase.rpc("print3d_finish_job", {
      p_job_id: v.jobId,
      p_actual_grams: v.actualGrams,
      p_actual_minutes: v.actualMinutes,
      p_spool_id: v.spoolId,
      p_post_minutes: v.postMinutes,
    });
    if (error) return fail(error.message || "No se pudo terminar el trabajo.");

    await logAudit(ctx, {
      action: "print3d.job.finish",
      entity: "print3d_job",
      entityId: v.jobId,
      summary: `Terminó «${job.title}»: ${Math.round(v.actualGrams)} g en ${Math.round(v.actualMinutes)} min`,
      diff: { actual_grams: v.actualGrams, actual_minutes: v.actualMinutes, spool_id: v.spoolId, post_minutes: v.postMinutes },
    });
    revalidateProduction(ctx.store.id, [job.order_id]);
    return ok();
  });
}

// ---------------------------------------------------------------------
// Falló (RPC print3d_fail_job: descuenta lo tirado y opcionalmente reimprime)
// ---------------------------------------------------------------------

const failSchema = z.object({
  jobId: uuid,
  wastedGrams: grams,
  reason: z.enum(FAILURE_REASONS, { errorMap: () => ({ message: "Elegí qué pasó." }) }),
  requeue: z.boolean(),
});

export async function failJob(input: unknown): Promise<ActionResult<{ requeuedJobId: string | null }>> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = failSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const job = await loadJob(ctx, v.jobId);
    if (!job) return fail("El trabajo no existe.");
    if (!isActive(job.status)) return fail("Ese trabajo ya está cerrado.");

    const { data, error } = await ctx.supabase.rpc("print3d_fail_job", {
      p_job_id: v.jobId,
      p_wasted_grams: v.wastedGrams,
      p_reason: v.reason,
      p_requeue: v.requeue,
    });
    if (error) return fail(error.message || "No se pudo marcar la falla.");
    const res = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
    const requeuedJobId = typeof res.requeued_job_id === "string" ? res.requeued_job_id : null;

    await logAudit(ctx, {
      action: "print3d.job.fail",
      entity: "print3d_job",
      entityId: v.jobId,
      summary: `Falló «${job.title}» (${FAILURE_REASON_LABELS[v.reason].toLowerCase()})${requeuedJobId ? ", se reimprime" : ""}`,
      diff: { reason: v.reason, wasted_grams: v.wastedGrams, requeued_job_id: requeuedJobId },
    });
    revalidateProduction(ctx.store.id, [job.order_id]);
    return ok({ requeuedJobId });
  });
}

// ---------------------------------------------------------------------
// Cancelar
// ---------------------------------------------------------------------

const cancelSchema = z.object({ jobId: uuid });

export async function cancelJob(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = cancelSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const job = await loadJob(ctx, parsed.data.jobId);
    if (!job) return fail("El trabajo no existe.");
    if (!isActive(job.status)) return fail("Ese trabajo ya está cerrado.");

    const { error } = await ctx.supabase
      .from("print3d_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("store_id", ctx.store.id)
      .eq("id", job.id)
      .in("status", [...ACTIVE_JOB_STATUSES]);
    if (error) return fail("No se pudo cancelar el trabajo.");

    await logAudit(ctx, {
      action: "print3d.job.cancel",
      entity: "print3d_job",
      entityId: job.id,
      summary: `Canceló «${job.title}»`,
      diff: { status: [job.status, "cancelled"] },
    });
    revalidateProduction(ctx.store.id, [job.order_id]);
    return ok();
  });
}

// ---------------------------------------------------------------------
// Pedido → cola
// ---------------------------------------------------------------------

/**
 * Los trabajos de productos del catálogo NO alimentan la calibración: sus
 * gramos y minutos los carga el taller (del laminador), no salen de la
 * fórmula del cotizador. Con `raw_*` en null, `print3d_finish_job` no los
 * mezcla con las muestras de las cotizaciones.
 */
const CATALOG_JOBS_FEED_CALIBRATION = false;

/** Fecha comprometida para los trabajos nuevos: greedy §3.5 contra la cola actual. */
async function dueDateFor(ctx: AdminContext, w: Workshop, drafts: readonly JobDraft[]): Promise<string> {
  const active = w.printers.filter((p) => p.status === "active");
  const materialType = new Map(w.materials.map((m) => [m.id, m.type]));
  if (!active.length) return defaultDueDate(w);
  const board = await listBoardJobs(ctx.supabase, ctx.store.id);
  const now = new Date();
  const unassigned = board.filter((j) => !j.printer_id).reduce((s, j) => s + remainingMinutes(j, now), 0);
  const estimate = estimateReadyDate(
    active.map((p) => ({
      id: p.id,
      bed: p.bed,
      materials: p.materials,
      // Lo que ya tiene + su parte de lo que todavía no está asignado.
      backlog_minutes:
        board.filter((j) => j.printer_id === p.id).reduce((s, j) => s + remainingMinutes(j, now), 0) + unassigned / active.length,
    })),
    drafts.map((d) => ({ minutes_total: d.est_minutes, material_type: materialType.get(d.material_id) ?? "PLA", bbox: [1, 1, 1] })),
    w.settings,
    now,
    w.timezone,
  );
  return estimate?.date ?? defaultDueDate(w);
}

const queueOrderSchema = z.object({ orderId: uuid });

export async function queueOrder(input: unknown): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const ctx = await moduleCtx();
    const parsed = queueOrderSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { orderId } = parsed.data;

    const { data: order } = await ctx.supabase
      .from("orders")
      .select("id, number, status")
      .eq("store_id", ctx.store.id)
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return fail("El pedido no existe.");
    if (order.status === "cancelled") return fail("El pedido está cancelado.");
    if (order.status === "delivered") return fail("El pedido ya se entregó.");

    const { data: items } = await ctx.supabase
      .from("order_items")
      .select("id, product_id, variant_id, name, variant_title, qty")
      .eq("order_id", order.id)
      .not("product_id", "is", null);
    const productIds = [...new Set((items ?? []).map((i) => i.product_id).filter((v): v is string => Boolean(v)))];
    const specs = await listProductSpecs(ctx.supabase, ctx.store.id, productIds);
    const withSpec = (items ?? []).filter((i) => specForItem(i, specs));
    if (!withSpec.length) return fail("Este pedido no tiene productos que se impriman.");

    const { data: existing } = await ctx.supabase
      .from("print3d_jobs")
      .select("order_item_id")
      .eq("store_id", ctx.store.id)
      .neq("status", "cancelled")
      .in(
        "order_item_id",
        withSpec.map((i) => i.id),
      );
    const queued = new Set((existing ?? []).map((j) => j.order_item_id));
    const drafts = withSpec
      .filter((i) => !queued.has(i.id))
      .flatMap((i) => plateJobsForItem({ ...i, qty: Number(i.qty) }, specForItem(i, specs)!));
    if (!drafts.length) return fail("Los productos de este pedido ya están en la cola.");

    const w = await getWorkshop(ctx.supabase, ctx.store.id);
    const due = await dueDateFor(ctx, w, drafts);

    const { data: tail } = await ctx.supabase
      .from("print3d_jobs")
      .select("position")
      .eq("store_id", ctx.store.id)
      .is("printer_id", null)
      .in("status", [...ACTIVE_JOB_STATUSES])
      .order("position", { ascending: false })
      .limit(1);
    const start = tail?.length ? Number(tail[0].position) + 1 : 0;

    const { error } = await ctx.supabase.from("print3d_jobs").insert(
      drafts.map((d, i) => ({
        store_id: ctx.store.id,
        order_id: order.id,
        order_item_id: d.order_item_id,
        product_id: d.product_id,
        variant_id: d.variant_id,
        title: d.title,
        qty: d.qty,
        status: "queued",
        position: start + i,
        material_id: d.material_id,
        color_id: d.color_id,
        quality_id: d.quality_id,
        est_grams: d.est_grams,
        est_minutes: d.est_minutes,
        raw_grams: CATALOG_JOBS_FEED_CALIBRATION ? d.est_grams : null,
        raw_minutes: CATALOG_JOBS_FEED_CALIBRATION ? d.est_minutes : null,
        post_minutes: d.post_minutes,
        due_date: due,
        created_by: ctx.user.id,
      })),
    );
    if (error) return fail("No se pudieron crear los trabajos.");

    const n = drafts.length;
    await insertOrderEvent(ctx, {
      orderId: order.id,
      type: "note",
      message: `Se ${n === 1 ? "mandó 1 trabajo" : `mandaron ${n} trabajos`} a la cola de impresión.`,
      data: { print3d_jobs: n, due_date: due },
    });
    await logAudit(ctx, {
      action: "print3d.job.queue_order",
      entity: "order",
      entityId: order.id,
      summary: `#${order.number}: ${n} ${n === 1 ? "trabajo" : "trabajos"} a la cola`,
    });
    revalidateProduction(ctx.store.id, [order.id]);
    return ok({ created: n });
  });
}
