import "server-only";

/**
 * Motor de jobs de importación: ejecución por pasos idempotentes y
 * reanudables (apto para funciones de 60 s en Vercel). Cada llamada a
 * `runJobStep` avanza hasta ~40 s y guarda el estado en `import_jobs.cursor`.
 *
 * Fases: discover → fetch → [review] → apply → [images] → done.
 */
import { revalidateTag } from "next/cache";

import { logAudit } from "@/lib/audit";
import type { AdminContext } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { assertFeature, limitOf, PlanError } from "@/lib/plans";
import { countUsage } from "@/lib/plans/server";
import { readImportOptions } from "@/lib/schemas/import";
import type { Json, Tables } from "@/lib/supabase/database.types";

import { getAdapter } from "./adapters";
import { applyCsvUpdate, applyProduct, type ApplyContext, type ApplyResult } from "./apply";
import { ScrapeError } from "./http";
import { importProductImages } from "./images";
import {
  importFeatureFor,
  readCursor,
  readLog,
  readPayload,
  readStats,
  toJson,
  type JobCursor,
  type JobPhase,
  type JobStats,
  type JobStatus,
  type LogLine,
} from "./job";
import { hostOf } from "./text";
import type { NormalizedCategory, NormalizedProduct, UrlAdapterId } from "./types";

/** Presupuesto de trabajo por llamada (la ruta tiene maxDuration = 60). */
const STEP_BUDGET_MS = 40_000;
const LOCK_MS = 75_000;
const APPLY_BATCH = 10;
const IMAGES_BATCH = 3;
const MAX_LOG = 200;

export interface StepResult {
  done: boolean;
  status: JobStatus;
  phase: JobPhase;
  stats: JobStats;
  /** El job espera la revisión del admin. */
  waiting?: boolean;
  /** Otra pestaña está corriendo el job. */
  busy?: boolean;
  error?: string | null;
}

export class JobNotFoundError extends Error {}

const URL_ADAPTERS: UrlAdapterId[] = ["woocommerce", "shopify", "jsonld"];

function asUrlAdapter(adapter: string): UrlAdapterId {
  if (adapter === "generic") return "jsonld";
  if ((URL_ADAPTERS as string[]).includes(adapter)) return adapter as UrlAdapterId;
  throw new ScrapeError(`Adaptador desconocido: ${adapter}`);
}

function nextAfterApply(job: Tables<"import_jobs">, cursor: JobCursor, importImages: boolean): JobPhase {
  if (!importImages) return "done";
  if (job.adapter === "csv" && cursor.csv?.mode === "update") return "done";
  return "images";
}

export async function runJobStep(ctx: AdminContext, jobId: string): Promise<StepResult> {
  const deadline = Date.now() + STEP_BUDGET_MS;
  const db = ctx.supabase;
  const storeId = ctx.store.id;

  const jobRes = await db.from("import_jobs").select("*").eq("store_id", storeId).eq("id", jobId).maybeSingle();
  if (!jobRes.data) throw new JobNotFoundError("not_found");
  const job = jobRes.data;
  const cursor = readCursor(job.cursor);
  const stats = readStats(job.stats);
  const log = readLog(job.log);
  const opts = readImportOptions(job.options);
  let status = job.status as JobStatus;

  const result = (extra: Partial<StepResult> = {}): StepResult => ({
    done: status === "done" || status === "failed" || status === "cancelled",
    status,
    phase: cursor.phase,
    stats,
    error: job.error,
    ...extra,
  });

  if (status === "done" || status === "failed" || status === "cancelled") return result();
  if (cursor.phase === "review") return result({ waiting: true });
  if (cursor.lockUntil && cursor.lockUntil > Date.now()) return result({ busy: true });
  // Si el plan bajó (ej. terminó la prueba), el job no sigue corriendo.
  assertFeature(ctx, importFeatureFor(job.adapter));

  // Lock optimista: sólo gana quien ve el mismo updated_at.
  const now = new Date().toISOString();
  const acquired = await db
    .from("import_jobs")
    .update({
      status: "running",
      started_at: job.started_at ?? now,
      cursor: toJson({ ...cursor, lockUntil: Date.now() + LOCK_MS }),
    })
    .eq("store_id", storeId)
    .eq("id", jobId)
    .eq("updated_at", job.updated_at)
    .select("id")
    .maybeSingle();
  if (!acquired.data) return result({ busy: true });
  status = "running";

  const addLog = (level: LogLine["level"], msg: string) => {
    log.push({ t: new Date().toISOString(), level, msg: msg.slice(0, 500) });
    if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
  };

  const sourceHost = hostOf(job.source_url);
  const applyCtx: ApplyContext = {
    db,
    storeId,
    plan: ctx.plan,
    // Se cuenta al entrar a "apply" (sólo si el plan limita los productos).
    productsUsed: 0,
    userId: ctx.user.id,
    jobId,
    adapter: job.adapter,
    sourceHost,
    options: opts,
    categoryDefs: { ...(cursor.categories ?? {}) },
    categoryCache: new Map(),
    touchedSlugs: new Set(),
    categoriesCreated: 0,
    csvFileName: cursor.csv?.fileName,
  };

  /** Persiste el estado. Devuelve false si el admin pausó el job mientras tanto. */
  const save = async (final?: { status: JobStatus; error?: string | null }, release = false): Promise<boolean> => {
    const keepLock = !final && !release && cursor.phase !== "review";
    const patch = {
      cursor: toJson({ ...cursor, lockUntil: keepLock ? Date.now() + LOCK_MS : null }),
      stats: toJson(stats),
      log: log.map((l) => toJson(l)),
      ...(final
        ? { status: final.status, error: final.error ?? null, finished_at: new Date().toISOString() }
        : {}),
    };
    const r = await db
      .from("import_jobs")
      .update(patch)
      .eq("store_id", storeId)
      .eq("id", jobId)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (r.error) throw new Error(`guardar job: ${r.error.message}`);
    return Boolean(r.data);
  };

  const revalidate = () => {
    if (applyCtx.touchedSlugs.size) {
      revalidateTag(tagFor("products", storeId), "max");
      for (const slug of applyCtx.touchedSlugs) {
        if (slug !== "__images__") revalidateTag(tagFor("product", storeId, slug), "max");
      }
      applyCtx.touchedSlugs.clear();
    }
    if (applyCtx.categoriesCreated) {
      revalidateTag(tagFor("categories", storeId), "max");
      applyCtx.categoriesCreated = 0;
    }
  };

  const countResult = (r: ApplyResult) => {
    if (r.status === "imported") stats.created += 1;
    else if (r.status === "updated") stats.updated += 1;
    else if (r.status === "skipped") stats.skipped += 1;
    else stats.errors += 1;
  };

  let productsCounted = false;
  try {
    let stop = false;
    while (!stop && Date.now() < deadline) {
      switch (cursor.phase) {
        case "discover": {
          if (job.adapter === "csv") {
            cursor.phase = "review";
            stop = true;
            break;
          }
          const adapter = getAdapter(asUrlAdapter(job.adapter));
          addLog("info", `Leyendo ${sourceHost || job.source_url}…`);
          const d = await adapter.discover(job.source_url, { limit: opts.limit });
          cursor.adapter = toJson(d.cursor);
          cursor.total = d.total;
          cursor.fetched = 0;
          const cats: Record<string, NormalizedCategory> = {};
          for (const c of d.categories ?? []) cats[c.externalId] = c;
          cursor.categories = cats;
          applyCtx.categoryDefs = { ...cats };
          for (const w of d.warnings ?? []) addLog("warn", w);
          addLog(
            "info",
            `${d.total === null ? "Cantidad de productos desconocida" : `${d.total} productos en la fuente`}` +
              (d.categories?.length ? ` · ${d.categories.length} categorías` : "") +
              (d.total !== null && d.total > opts.limit ? ` · se traen hasta ${opts.limit}` : ""),
          );
          cursor.phase = "fetch";
          break;
        }

        case "fetch": {
          const adapter = getAdapter(asUrlAdapter(job.adapter));
          const page = await adapter.fetchPage(job.source_url, cursor.adapter ?? null);
          for (const w of (page.warnings ?? []).slice(0, 20)) addLog("warn", w);
          const fetched = cursor.fetched ?? 0;
          const products = page.products.slice(0, Math.max(0, opts.limit - fetched));
          if (products.length) {
            const rows = products.map((p) => ({
              store_id: storeId,
              job_id: jobId,
              external_id: p.externalId.slice(0, 500),
              name: p.name.slice(0, 300),
              payload: toJson({ kind: "product", product: p }),
              status: "pending",
            }));
            const ins = await db.from("import_items").upsert(rows, { onConflict: "job_id,external_id", ignoreDuplicates: true });
            if (ins.error) throw new Error(`guardar ítems: ${ins.error.message}`);
          }
          cursor.fetched = fetched + products.length;
          stats.found = cursor.fetched;
          addLog("info", `Leídos ${cursor.fetched}${cursor.total ? ` de ${Math.min(cursor.total, opts.limit)}` : ""} productos`);
          if (!page.next || cursor.fetched >= opts.limit) {
            cursor.adapter = null;
            cursor.phase = opts.review ? "review" : "apply";
            addLog("info", opts.review ? "Lectura terminada. Elegí qué importar." : "Lectura terminada. Aplicando cambios…");
            if (opts.review) stop = true;
          } else {
            cursor.adapter = toJson(page.next);
          }
          break;
        }

        case "apply": {
          if (!productsCounted) {
            productsCounted = true;
            if (limitOf(ctx.plan, "products") !== null) applyCtx.productsUsed = await countUsage(ctx, "products");
          }
          const items = await db
            .from("import_items")
            .select("id, name, payload")
            .eq("store_id", storeId)
            .eq("job_id", jobId)
            .eq("status", "pending")
            .order("created_at")
            .order("id")
            .limit(APPLY_BATCH);
          if (items.error) throw new Error(`leer ítems: ${items.error.message}`);
          if (!items.data.length) {
            cursor.phase = nextAfterApply(job, cursor, opts.import_images);
            addLog(
              "info",
              `Cambios aplicados: ${stats.created} creados, ${stats.updated} actualizados, ${stats.skipped} omitidos, ${stats.errors} con error.`,
            );
            if (cursor.phase === "images") addLog("info", "Descargando imágenes…");
            break;
          }
          for (const item of items.data) {
            if (Date.now() > deadline) break;
            const payload = readPayload(item.payload);
            let res: ApplyResult;
            if (payload?.kind === "product") res = await applyProduct(applyCtx, payload.product);
            else if (payload?.kind === "csv-update") res = await applyCsvUpdate(applyCtx, payload.diff);
            else res = { status: "error", productId: null, message: "Ítem inválido.", priceChanges: 0 };
            countResult(res);
            const up = await db
              .from("import_items")
              .update({ status: res.status, product_id: res.productId, error: res.message })
              .eq("store_id", storeId)
              .eq("id", item.id);
            if (up.error) throw new Error(`actualizar ítem: ${up.error.message}`);
            if (res.status === "error") addLog("error", `${item.name ?? "Ítem"}: ${res.message ?? "error"}`);
          }
          break;
        }

        case "images": {
          let q = db
            .from("import_items")
            .select("id, name, payload, product_id")
            .eq("store_id", storeId)
            .eq("job_id", jobId)
            // Con update_existing, los existentes "sin cambios" también suman imágenes nuevas.
            .in("status", opts.update_existing ? ["imported", "updated", "skipped"] : ["imported", "updated"])
            .not("product_id", "is", null)
            .order("id")
            .limit(IMAGES_BATCH);
          if (cursor.imagesAfter) q = q.gt("id", cursor.imagesAfter);
          const items = await q;
          if (items.error) throw new Error(`leer ítems: ${items.error.message}`);
          if (!items.data.length) {
            cursor.phase = "done";
            addLog("info", `Imágenes subidas: ${stats.images}.`);
            break;
          }
          for (const item of items.data) {
            if (Date.now() > deadline) break;
            const payload = readPayload(item.payload);
            if (payload?.kind === "product" && item.product_id) {
              try {
                const r = await importProductImages(
                  db,
                  storeId,
                  item.product_id,
                  payload.product as NormalizedProduct,
                  limitOf(ctx.plan, "images_per_product"),
                );
                stats.images += r.uploaded;
                if (r.failed) addLog("warn", `${item.name ?? "Producto"}: ${r.failed} imágenes no se pudieron bajar (${r.errors[0] ?? ""})`);
                if (r.uploaded) applyCtx.touchedSlugs.add("__images__");
              } catch (err) {
                addLog("warn", `${item.name ?? "Producto"}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
            cursor.imagesAfter = item.id;
          }
          break;
        }

        case "done": {
          applyCtx.touchedSlugs.delete("__images__");
          addLog(
            "info",
            `Importación terminada: ${stats.created} creados, ${stats.updated} actualizados, ${stats.skipped} omitidos, ${stats.errors} con error, ${stats.images} imágenes.`,
          );
          status = "done";
          await save({ status: "done" });
          await logAudit(ctx, {
            action: "import.run",
            entity: "import_job",
            entityId: jobId,
            summary: `Importación ${job.adapter} de ${sourceHost || job.source_url}: ${stats.created} creados, ${stats.updated} actualizados, ${stats.errors} con error`,
            diff: toJson({ stats, options: opts }) as Json,
          });
          revalidateTag(tagFor("products", storeId), "max");
          revalidateTag(tagFor("categories", storeId), "max");
          revalidate();
          return result({ done: true });
        }

        case "review":
          stop = true;
          break;
      }

      if (applyCtx.touchedSlugs.has("__images__")) {
        applyCtx.touchedSlugs.delete("__images__");
        revalidateTag(tagFor("products", storeId), "max");
      }
      if (!(await save())) {
        status = "cancelled";
        revalidate();
        return result({ done: true });
      }
    }
    // Fin del presupuesto de este paso: se libera el lock para el próximo /run.
    if (!(await save(undefined, true))) status = "cancelled";
    revalidate();
    return result({ waiting: cursor.phase === "review", done: status === "cancelled" });
  } catch (err) {
    // PlanError: se llegó al límite de productos del plan → el job se corta con ese mensaje.
    const known = err instanceof ScrapeError || err instanceof PlanError;
    const message = known
      ? err instanceof PlanError
        ? `${err.message} La importación se detuvo: los productos que faltan quedaron pendientes.`
        : err.message
      : "Algo salió mal durante la importación. Podés reanudarla.";
    if (!known) console.error("[import]", err);
    addLog("error", known ? message : `${message} (${err instanceof Error ? err.message : String(err)})`);
    status = "failed";
    job.error = message;
    await save({ status: "failed", error: message }).catch(() => false);
    revalidate();
    return result({ done: true, error: message });
  }
}
