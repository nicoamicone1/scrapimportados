"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { assertFeature } from "@/lib/plans";
import { assertUsage } from "@/lib/plans/server";
import { detectAdapter } from "@/lib/scraper/adapters";
import { assertPublicUrl, ScrapeError } from "@/lib/scraper/http";
import { importFeatureFor, readCursor, toJson, type JobCursor, type LogLine } from "@/lib/scraper/job";
import { hostOf } from "@/lib/scraper/text";
import type { UrlAdapterId } from "@/lib/scraper/types";
import { createJobSchema, readImportOptions, selectItemsSchema, type CreateJobInput } from "@/lib/schemas/import";

const idSchema = z.string().uuid();

function line(msg: string, level: LogLine["level"] = "info"): LogLine {
  return { t: new Date().toISOString(), level, msg };
}

/** Crea un job desde una URL (el cliente después llama a /run en loop). */
export async function createImportJob(input: CreateJobInput): Promise<ActionResult<{ jobId: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    assertFeature(ctx, "catalog.import_web");
    const parsed = createJobSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { url, options } = parsed.data;
    if (options.category_mode === "single" && !options.default_category_id) {
      return fail("Elegí la categoría donde van los productos.", { "options.default_category_id": ["Elegí una categoría."] });
    }
    if (options.default_category_id) {
      const cat = await ctx.supabase
        .from("categories")
        .select("id")
        .eq("store_id", ctx.store.id)
        .eq("id", options.default_category_id)
        .maybeSingle();
      if (!cat.data) {
        return fail("La categoría elegida ya no existe.", { "options.default_category_id": ["Elegí otra categoría."] });
      }
    }
    await assertUsage(ctx, "import_jobs_month");

    let adapter: UrlAdapterId;
    try {
      await assertPublicUrl(url);
      adapter = parsed.data.adapter === "auto" ? await detectAdapter(url) : parsed.data.adapter;
    } catch (err) {
      if (err instanceof ScrapeError) return fail(err.message);
      throw err;
    }

    const cursor: JobCursor = { phase: "discover" };
    const r = await ctx.supabase
      .from("import_jobs")
      .insert({
        store_id: ctx.store.id,
        source_url: url,
        adapter,
        status: "queued",
        options: toJson(options),
        cursor: toJson(cursor),
        log: [toJson(line(`Importación creada (${adapter}) para ${hostOf(url)}.`))],
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (r.error) throw new Error(r.error.message);
    await logAudit(ctx, {
      action: "import.create",
      entity: "import_job",
      entityId: r.data.id,
      summary: `Nueva importación ${adapter} desde ${hostOf(url)}`,
    });
    revalidatePath("/admin/importar");
    return ok({ jobId: r.data.id });
  });
}

/** Pausa un job en curso (status `cancelled`; se puede reanudar). */
export async function pauseImportJob(jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!idSchema.safeParse(jobId).success) return fail("Importación inexistente.");
    const job = await ctx.supabase
      .from("import_jobs")
      .select("id, status, log, cursor")
      .eq("store_id", ctx.store.id)
      .eq("id", jobId)
      .maybeSingle();
    if (!job.data) return fail("Importación inexistente.");
    if (job.data.status !== "running" && job.data.status !== "queued") return fail("La importación no está en curso.");
    const cursor = readCursor(job.data.cursor);
    const r = await ctx.supabase
      .from("import_jobs")
      .update({
        status: "cancelled",
        cursor: toJson({ ...cursor, lockUntil: null }),
        log: [...job.data.log, toJson(line("Pausada por el usuario.", "warn"))].slice(-200),
      })
      .eq("store_id", ctx.store.id)
      .eq("id", jobId);
    if (r.error) throw new Error(r.error.message);
    revalidatePath(`/admin/importar/${jobId}`);
    return ok();
  });
}

/** Reanuda un job pausado o fallido desde su cursor. */
export async function resumeImportJob(jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!idSchema.safeParse(jobId).success) return fail("Importación inexistente.");
    const job = await ctx.supabase
      .from("import_jobs")
      .select("id, adapter, status, log, cursor, finished_at")
      .eq("store_id", ctx.store.id)
      .eq("id", jobId)
      .maybeSingle();
    if (!job.data) return fail("Importación inexistente.");
    assertFeature(ctx, importFeatureFor(job.data.adapter));
    if (job.data.status !== "cancelled" && job.data.status !== "failed") return fail("La importación no está pausada.");
    if (job.data.status === "cancelled" && job.data.finished_at) return fail("Esta importación se descartó. Creá una nueva.");
    const cursor = readCursor(job.data.cursor);
    const r = await ctx.supabase
      .from("import_jobs")
      .update({
        status: "running",
        error: null,
        finished_at: null,
        cursor: toJson({ ...cursor, lockUntil: null }),
        log: [...job.data.log, toJson(line("Reanudada."))].slice(-200),
      })
      .eq("store_id", ctx.store.id)
      .eq("id", jobId);
    if (r.error) throw new Error(r.error.message);
    return ok();
  });
}

/** "Volver a sincronizar": nuevo job con la misma fuente y opciones. */
export async function resyncImportJob(jobId: string): Promise<ActionResult<{ jobId: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!idSchema.safeParse(jobId).success) return fail("Importación inexistente.");
    const job = await ctx.supabase
      .from("import_jobs")
      .select("source_url, adapter, options")
      .eq("store_id", ctx.store.id)
      .eq("id", jobId)
      .maybeSingle();
    if (!job.data) return fail("Importación inexistente.");
    if (job.data.adapter === "csv") return fail("Las importaciones de CSV no se re-sincronizan: subí el archivo nuevo.");
    assertFeature(ctx, "catalog.import_web");
    await assertUsage(ctx, "import_jobs_month");
    const options = readImportOptions(job.data.options);
    const r = await ctx.supabase
      .from("import_jobs")
      .insert({
        store_id: ctx.store.id,
        source_url: job.data.source_url,
        adapter: job.data.adapter,
        status: "queued",
        options: toJson(options),
        cursor: toJson({ phase: "discover" } satisfies JobCursor),
        log: [toJson(line(`Re-sincronización de la importación ${jobId.slice(0, 8)}.`))],
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (r.error) throw new Error(r.error.message);
    await logAudit(ctx, {
      action: "import.resync",
      entity: "import_job",
      entityId: r.data.id,
      summary: `Re-sincronización desde ${hostOf(job.data.source_url)}`,
    });
    revalidatePath("/admin/importar");
    return ok({ jobId: r.data.id });
  });
}

/**
 * Fase "review": los ítems elegidos quedan pendientes y el resto se omite;
 * el job pasa a "apply" (el cliente vuelve a llamar a /run).
 */
export async function importSelectedItems(input: z.input<typeof selectItemsSchema>): Promise<ActionResult<{ selected: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = selectItemsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { jobId, itemIds, all } = parsed.data;

    const storeId = ctx.store.id;
    const job = await ctx.supabase
      .from("import_jobs")
      .select("id, status, cursor, log, stats")
      .eq("store_id", storeId)
      .eq("id", jobId)
      .maybeSingle();
    if (!job.data) return fail("Importación inexistente.");
    const cursor = readCursor(job.data.cursor);
    if (cursor.phase !== "review" || job.data.status !== "running") return fail("Esta importación no está esperando revisión.");

    let selected = 0;
    if (all) {
      const c = await ctx.supabase
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("job_id", jobId)
        .eq("status", "pending");
      selected = c.count ?? 0;
    } else {
      if (!itemIds.length) return fail("Elegí al menos un producto.");
      // Todo lo pendiente que NO se eligió pasa a omitido.
      const pendingIds: string[] = [];
      for (let from = 0; ; from += 1000) {
        const page = await ctx.supabase
          .from("import_items")
          .select("id")
          .eq("store_id", storeId)
          .eq("job_id", jobId)
          .eq("status", "pending")
          .order("id")
          .range(from, from + 999);
        if (page.error) throw new Error(page.error.message);
        pendingIds.push(...page.data.map((p) => p.id));
        if (page.data.length < 1000) break;
      }
      const chosen = new Set(itemIds);
      const drop = pendingIds.filter((id) => !chosen.has(id));
      selected = pendingIds.length - drop.length;
      for (let i = 0; i < drop.length; i += 200) {
        const r = await ctx.supabase
          .from("import_items")
          .update({ status: "skipped", error: "No seleccionado." })
          .eq("store_id", storeId)
          .in("id", drop.slice(i, i + 200));
        if (r.error) throw new Error(r.error.message);
      }
      const stats = job.data.stats && typeof job.data.stats === "object" && !Array.isArray(job.data.stats) ? job.data.stats : {};
      const skipped = Number((stats as Record<string, unknown>).skipped ?? 0) + drop.length;
      await ctx.supabase
        .from("import_jobs")
        .update({ stats: toJson({ ...stats, skipped }) })
        .eq("store_id", storeId)
        .eq("id", jobId);
    }
    if (!selected) return fail("No hay nada para aplicar.");

    const r = await ctx.supabase
      .from("import_jobs")
      .update({
        cursor: toJson({ ...cursor, phase: "apply", lockUntil: null }),
        log: [...job.data.log, toJson(line(`Revisión: ${selected} seleccionados para aplicar.`))].slice(-200),
      })
      .eq("store_id", storeId)
      .eq("id", jobId);
    if (r.error) throw new Error(r.error.message);
    return ok({ selected });
  });
}

/** Descarta un job en revisión o pausado (no toca productos ya aplicados). */
export async function discardImportJob(jobId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (!idSchema.safeParse(jobId).success) return fail("Importación inexistente.");
    const job = await ctx.supabase
      .from("import_jobs")
      .select("id, status, cursor, log")
      .eq("store_id", ctx.store.id)
      .eq("id", jobId)
      .maybeSingle();
    if (!job.data) return fail("Importación inexistente.");
    const r = await ctx.supabase
      .from("import_jobs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        cursor: toJson({ ...readCursor(job.data.cursor), lockUntil: null }),
        log: [...job.data.log, toJson(line("Descartada por el usuario.", "warn"))].slice(-200),
      })
      .eq("store_id", ctx.store.id)
      .eq("id", jobId);
    if (r.error) throw new Error(r.error.message);
    const pend = await ctx.supabase
      .from("import_items")
      .update({ status: "skipped", error: "Importación descartada." })
      .eq("store_id", ctx.store.id)
      .eq("job_id", jobId)
      .eq("status", "pending");
    if (pend.error) throw new Error(pend.error.message);
    revalidatePath("/admin/importar");
    return ok();
  });
}
