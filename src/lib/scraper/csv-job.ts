import "server-only";

/**
 * Alta de un job CSV: parsea el archivo, arma el diff contra la base y deja
 * el job en fase "review" (la vista previa es obligatoria antes de aplicar).
 */
import type { AdminContext } from "@/lib/auth";
import { CSV_MAX_ROWS, type CsvMode, type ImportOptions } from "@/lib/schemas/import";
import type { TablesInsert } from "@/lib/supabase/database.types";

import {
  diffUpdateRows,
  missingColumns,
  parseCreateRows,
  parseCsvText,
  parseUpdateRows,
  type ExistingVariant,
} from "./csv";
import { EMPTY_STATS, toJson, type JobCursor, type LogLine } from "./job";

export class CsvJobError extends Error {}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Decodifica el archivo: UTF-8 (con o sin BOM) y, si no es válido, Windows-1252 (Excel viejo). */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function loadVariantsBySku(ctx: AdminContext, skus: string[]): Promise<Map<string, ExistingVariant[]>> {
  const index = new Map<string, ExistingVariant[]>();
  const wanted = [...new Set(skus.flatMap((s) => [s, s.toUpperCase(), s.toLowerCase()]))];
  for (const part of chunk(wanted, 150)) {
    const r = await ctx.supabase
      .from("product_variants")
      .select("id, product_id, title, sku, price, compare_at_price, cost, stock, track_inventory, products(name, status)")
      .in("sku", part);
    if (r.error) throw new Error(r.error.message);
    for (const v of r.data) {
      if (!v.sku) continue;
      const product = Array.isArray(v.products) ? v.products[0] : v.products;
      const key = v.sku.toLowerCase();
      const list = index.get(key) ?? [];
      if (list.some((x) => x.variant_id === v.id)) continue;
      list.push({
        variant_id: v.id,
        product_id: v.product_id,
        product_name: product?.name ?? "",
        product_status: product?.status ?? "draft",
        variant_title: v.title,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        cost: v.cost,
        stock: v.stock,
        track_inventory: v.track_inventory,
      });
      index.set(key, list);
    }
  }
  return index;
}

export async function createCsvJob(
  ctx: AdminContext,
  input: { fileName: string; text: string; mode: CsvMode; options: ImportOptions },
): Promise<{ jobId: string }> {
  const parsed = parseCsvText(input.text);
  if (!parsed.headers.length || !parsed.records.length) throw new CsvJobError("El archivo está vacío o no tiene filas.");
  const missing = missingColumns(parsed.headers, input.mode);
  if (missing.length) {
    throw new CsvJobError(
      `Faltan columnas obligatorias: ${missing.join(", ")}. ${input.mode === "update" ? "Para actualizar por SKU necesitás al menos la columna sku." : "Para crear productos necesitás name y price."}`,
    );
  }
  if (parsed.records.length > CSV_MAX_ROWS) throw new CsvJobError(`El archivo tiene más de ${CSV_MAX_ROWS} filas. Dividilo en partes.`);

  const items: Omit<TablesInsert<"import_items">, "job_id">[] = [];
  const stats = { ...EMPTY_STATS, found: parsed.records.length };

  if (input.mode === "update") {
    const { rows, errors } = parseUpdateRows(parsed.records);
    const existing = await loadVariantsBySku(ctx, rows.map((r) => r.sku));
    for (const d of diffUpdateRows(rows, errors, existing)) {
      const status = d.kind === "error" ? "error" : d.kind === "same" ? "skipped" : "pending";
      if (status === "error") stats.errors += 1;
      if (status === "skipped") stats.skipped += 1;
      items.push({
        external_id: `L${String(d.line).padStart(6, "0")}`,
        name: d.variant ? `${d.variant.product_name}${d.variant.variant_title !== "Default" ? ` · ${d.variant.variant_title}` : ""}` : d.sku || `Fila ${d.line}`,
        payload: toJson({ kind: "csv-update", diff: d }),
        status,
        error: d.error ?? (d.kind === "same" ? "Sin cambios." : null),
        product_id: d.variant?.product_id ?? null,
      });
    }
  } else {
    const { groups, errors } = parseCreateRows(parsed.records);
    const existing = new Map<string, string>();
    for (const part of chunk(groups.map((g) => g.handle), 150)) {
      const r = await ctx.supabase.from("products").select("id, slug").in("slug", part);
      for (const p of r.data ?? []) existing.set(p.slug, p.id);
    }
    for (const g of groups) {
      items.push({
        external_id: g.handle,
        name: g.product.name,
        payload: toJson({ kind: "product", product: g.product, lines: g.lines, existingId: existing.get(g.handle) ?? null }),
        status: "pending",
        product_id: existing.get(g.handle) ?? null,
      });
    }
    for (const e of errors) {
      stats.errors += 1;
      items.push({
        external_id: `L${String(e.line).padStart(6, "0")}`,
        name: e.key || `Fila ${e.line}`,
        payload: toJson({ kind: "csv-error", line: e.line, key: e.key, message: e.message }),
        status: "error",
        error: e.message,
      });
    }
  }

  const now = new Date().toISOString();
  const log: LogLine[] = [
    {
      t: now,
      level: "info",
      msg: `Archivo ${input.fileName}: ${parsed.records.length} filas (separador "${parsed.delimiter === "\t" ? "tab" : parsed.delimiter}"), modo ${input.mode === "update" ? "actualizar por SKU" : "crear productos"}.`,
    },
    ...parsed.errors.map((m): LogLine => ({ t: now, level: "warn", msg: m })),
    {
      t: now,
      level: "info",
      msg: `Vista previa lista: ${items.filter((i) => i.status === "pending").length} para aplicar, ${stats.skipped} sin cambios, ${stats.errors} con error.`,
    },
  ];
  const cursor: JobCursor = { phase: "review", csv: { mode: input.mode, fileName: input.fileName, rows: parsed.records.length } };

  const job = await ctx.supabase
    .from("import_jobs")
    .insert({
      source_url: `csv:${input.fileName}`.slice(0, 300),
      adapter: "csv",
      status: "running",
      options: toJson({ ...input.options, review: true }),
      stats: toJson(stats),
      cursor: toJson(cursor),
      log: log.map((l) => toJson(l)),
      started_at: now,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (job.error) throw new Error(job.error.message);

  for (const part of chunk(items, 500)) {
    const r = await ctx.supabase.from("import_items").insert(part.map((i) => ({ ...i, job_id: job.data.id })));
    if (r.error) {
      await ctx.supabase.from("import_jobs").delete().eq("id", job.data.id);
      throw new Error(r.error.message);
    }
  }
  return { jobId: job.data.id };
}
