/**
 * Estado de un job de importación (lo que vive en `import_jobs.cursor`,
 * `stats` y `log`). Sin dependencias de server: lo usan también los
 * componentes del admin.
 */
import type { Json } from "@/lib/supabase/database.types";

import type { CsvUpdateDiff } from "./csv";
import type { NormalizedCategory, NormalizedProduct } from "./types";

export type JobPhase = "discover" | "fetch" | "review" | "apply" | "images" | "done";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type ItemStatus = "pending" | "imported" | "updated" | "skipped" | "error";

export const PHASES: { id: JobPhase; label: string }[] = [
  { id: "discover", label: "Detectar" },
  { id: "fetch", label: "Leer catálogo" },
  { id: "review", label: "Revisión" },
  { id: "apply", label: "Aplicar" },
  { id: "images", label: "Imágenes" },
  { id: "done", label: "Listo" },
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "En cola",
  running: "En curso",
  done: "Terminado",
  failed: "Falló",
  cancelled: "Pausado",
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  pending: "Pendiente",
  imported: "Creado",
  updated: "Actualizado",
  skipped: "Omitido",
  error: "Error",
};

export interface JobCursor {
  phase: JobPhase;
  /** Cursor opaco del adaptador (página, URLs pendientes…). */
  adapter?: Json | null;
  /** Categorías del origen (id externo → definición) para armar la jerarquía. */
  categories?: Record<string, NormalizedCategory>;
  /** Cantidad estimada en la fuente. */
  total?: number | null;
  fetched?: number;
  /** Último import_item procesado en la fase de imágenes. */
  imagesAfter?: string | null;
  /** Lock optimista para que dos pestañas no corran el mismo job (epoch ms). */
  lockUntil?: number | null;
  /** Datos del archivo en jobs CSV. */
  csv?: { mode: "update" | "create"; fileName: string; rows: number } | null;
}

export interface JobStats {
  found: number;
  created: number;
  updated: number;
  skipped: number;
  images: number;
  errors: number;
}

export interface LogLine {
  t: string;
  level: "info" | "warn" | "error";
  msg: string;
}

export const EMPTY_STATS: JobStats = { found: 0, created: 0, updated: 0, skipped: 0, images: 0, errors: 0 };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readCursor(value: Json | null | undefined): JobCursor {
  if (!isRecord(value)) return { phase: "discover" };
  const phase = typeof value.phase === "string" ? (value.phase as JobPhase) : "discover";
  return { ...(value as unknown as JobCursor), phase };
}

export function readStats(value: Json | null | undefined): JobStats {
  const out: JobStats = { ...EMPTY_STATS };
  if (!isRecord(value)) return out;
  for (const k of Object.keys(out) as (keyof JobStats)[]) {
    const n = Number(value[k]);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export function readLog(value: Json[] | null | undefined): LogLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((l): LogLine[] =>
    isRecord(l)
      ? [
          {
            t: String(l.t ?? ""),
            level: l.level === "warn" || l.level === "error" ? l.level : "info",
            msg: String(l.msg ?? ""),
          },
        ]
      : [],
  );
}

/** Convierte un objeto tipado al tipo `Json` de Supabase. */
export function toJson<T>(value: T): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

// ---------------------------------------------------------------------------
// Payload de import_items
// ---------------------------------------------------------------------------

export type ItemPayload =
  | { kind: "product"; product: NormalizedProduct; lines?: number[]; existingId?: string | null }
  | { kind: "csv-update"; diff: CsvUpdateDiff }
  | { kind: "csv-error"; line: number; key: string; message: string };

export function readPayload(value: Json): ItemPayload | null {
  if (!isRecord(value)) return null;
  if (value.kind === "product" && isRecord(value.product)) return value as unknown as ItemPayload;
  if (value.kind === "csv-update" && isRecord(value.diff)) return value as unknown as ItemPayload;
  if (value.kind === "csv-error") return value as unknown as ItemPayload;
  return null;
}

/** Fila liviana para las tablas del detalle (sin el payload completo). */
export interface ItemRow {
  id: string;
  external_id: string | null;
  name: string | null;
  status: ItemStatus;
  error: string | null;
  product_id: string | null;
  product_slug: string | null;
  /** Resumen legible: "Nuevo · 3 variantes · $ 12.990" o el diff del CSV. */
  summary: string;
  image: string | null;
  price: number | null;
  line: number | null;
  changes: { field: string; from: number | string | null; to: number | string | null }[];
}

/** Feature del plan que habilita correr un job con este adaptador. */
export function importFeatureFor(adapter: string): "catalog.import_csv" | "catalog.import_web" {
  return adapter === "csv" ? "catalog.import_csv" : "catalog.import_web";
}

/** Título corto de un job: host de la fuente o nombre del archivo CSV. */
export function jobTitle(job: { adapter: string; source_url: string; csv?: JobCursor["csv"] }): string {
  if (job.adapter === "csv") return job.csv?.fileName ?? job.source_url.replace(/^csv:/, "");
  try {
    return new URL(job.source_url).host.replace(/^www\./, "");
  } catch {
    return job.source_url;
  }
}
