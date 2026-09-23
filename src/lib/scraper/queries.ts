import "server-only";

/** Lecturas del admin para el importador (sin cache, bajo RLS), siempre de la tienda activa. */
import type { AdminContext } from "@/lib/auth";
import { readImportOptions, type ImportOptions } from "@/lib/schemas/import";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

import {
  readCursor,
  readLog,
  readPayload,
  readStats,
  type ItemRow,
  type ItemStatus,
  type JobCursor,
  type JobPhase,
  type JobStats,
  type JobStatus,
  type LogLine,
} from "./job";
import { applyMarkup } from "./text";

type StoreDb = Pick<AdminContext, "supabase" | "store">;

export interface JobSummary {
  id: string;
  source_url: string;
  adapter: string;
  status: JobStatus;
  phase: JobPhase;
  options: ImportOptions;
  stats: JobStats;
  total: number | null;
  fetched: number;
  csv: JobCursor["csv"];
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  created_by_email: string | null;
}

export interface JobDetail extends JobSummary {
  log: LogLine[];
}

type JobRow = {
  id: string;
  source_url: string;
  adapter: string;
  status: string;
  options: Json;
  stats: Json;
  cursor: Json | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

function toSummary(row: JobRow, emails: Map<string, string>): JobSummary {
  const cursor = readCursor(row.cursor);
  return {
    id: row.id,
    source_url: row.source_url,
    adapter: row.adapter,
    status: row.status as JobStatus,
    phase: cursor.phase,
    options: readImportOptions(row.options),
    stats: readStats(row.stats),
    total: cursor.total ?? null,
    fetched: cursor.fetched ?? 0,
    csv: cursor.csv ?? null,
    error: row.error,
    started_at: row.started_at,
    finished_at: row.finished_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    created_by_email: row.created_by ? emails.get(row.created_by) ?? null : null,
  };
}

async function emailsFor(db: ServerSupabase, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return new Map();
  const r = await db.from("profiles").select("id, email, name").in("id", unique);
  return new Map((r.data ?? []).map((p) => [p.id, p.name || p.email]));
}

const JOB_COLUMNS =
  "id, source_url, adapter, status, options, stats, cursor, error, started_at, finished_at, created_at, updated_at, created_by";

export async function listJobs(ctx: StoreDb, page: number, perPage: number): Promise<{ rows: JobSummary[]; total: number }> {
  const db = ctx.supabase;
  const from = (page - 1) * perPage;
  const r = await db
    .from("import_jobs")
    .select(JOB_COLUMNS, { count: "exact" })
    .eq("store_id", ctx.store.id)
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);
  if (r.error) throw new Error(r.error.message);
  const emails = await emailsFor(db, r.data.map((j) => j.created_by));
  return { rows: r.data.map((j) => toSummary(j, emails)), total: r.count ?? r.data.length };
}

export async function getJob(ctx: StoreDb, id: string): Promise<JobDetail | null> {
  const r = await ctx.supabase
    .from("import_jobs")
    .select(`${JOB_COLUMNS}, log`)
    .eq("store_id", ctx.store.id)
    .eq("id", id)
    .maybeSingle();
  if (r.error || !r.data) return null;
  const emails = await emailsFor(ctx.supabase, [r.data.created_by]);
  return { ...toSummary(r.data, emails), log: readLog(r.data.log) };
}

export const ITEM_STATUSES: ItemStatus[] = ["pending", "imported", "updated", "skipped", "error"];

export async function listItems(
  ctx: StoreDb,
  jobId: string,
  filters: { status?: ItemStatus | "all"; q?: string; page: number; perPage: number; options: ImportOptions },
): Promise<{ rows: ItemRow[]; total: number; counts: Record<ItemStatus | "all", number> }> {
  const db = ctx.supabase;
  const storeId = ctx.store.id;
  const from = (filters.page - 1) * filters.perPage;
  let q = db
    .from("import_items")
    .select("id, external_id, name, status, error, product_id, payload, products(slug)", { count: "exact" })
    .eq("store_id", storeId)
    .eq("job_id", jobId)
    .order("created_at")
    .order("external_id")
    .range(from, from + filters.perPage - 1);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  const term = filters.q?.trim().replace(/[%,()]/g, " ");
  if (term) q = q.or(`name.ilike.%${term}%,external_id.ilike.%${term}%`);
  const r = await q;
  if (r.error) throw new Error(r.error.message);

  const countRes = await Promise.all(
    ITEM_STATUSES.map((s) =>
      db
        .from("import_items")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("job_id", jobId)
        .eq("status", s),
    ),
  );
  const counts = { all: 0 } as Record<ItemStatus | "all", number>;
  ITEM_STATUSES.forEach((s, i) => {
    counts[s] = countRes[i].count ?? 0;
    counts.all += counts[s];
  });

  const rows: ItemRow[] = r.data.map((item) => {
    const payload = readPayload(item.payload);
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    const base: ItemRow = {
      id: item.id,
      external_id: item.external_id,
      name: item.name,
      status: item.status as ItemStatus,
      error: item.error,
      product_id: item.product_id,
      product_slug: product?.slug ?? null,
      summary: "",
      image: null,
      price: null,
      line: null,
      changes: [],
    };
    if (payload?.kind === "product") {
      const p = payload.product;
      const prices = p.variants.map((v) => v.price).filter((n): n is number => n !== null);
      const min = prices.length ? Math.min(...prices) : null;
      base.price = applyMarkup(min, filters.options.markup_percent, filters.options.round_to);
      base.image = p.images[0] ?? null;
      const parts = [p.variants.length === 1 ? "1 variante" : `${p.variants.length} variantes`];
      if (p.categories.length) parts.push(p.categories.map((c) => c.name).join(", "));
      if (payload.existingId) parts.unshift("Ya existe");
      if (payload.lines?.length) base.line = payload.lines[0];
      base.summary = parts.join(" · ");
    } else if (payload?.kind === "csv-update") {
      base.line = payload.diff.line;
      base.changes = payload.diff.changes;
      base.summary = payload.diff.variant ? `${payload.diff.variant.product_name} · ${payload.diff.variant.variant_title}` : "";
    } else if (payload?.kind === "csv-error") {
      base.line = payload.line;
    }
    return base;
  });

  return { rows, total: r.count ?? rows.length, counts };
}
