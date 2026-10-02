import { fitsPrinter } from "@/lib/print3d";
import type { CostInputs, Geometry, MaterialType } from "@/lib/print3d/types";

/*
 * Taller 3D — lógica pura de producción (cola, costeo, verificación de
 * geometría). Sin Supabase ni server-only: la usan las lecturas del admin,
 * las server actions, los componentes cliente y los tests.
 * Spec: docs/modules/TALLER-3D.md §3.5, §3.6 y §6.
 */

// ---------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------

export const JOB_STATUSES = ["queued", "printing", "post", "done", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Los que están en el tablero (todavía ocupan una impresora o esperan). */
export const ACTIVE_JOB_STATUSES = ["queued", "printing", "post"] as const satisfies readonly JobStatus[];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "En cola",
  printing: "Imprimiendo",
  post: "Post-proceso",
  done: "Terminado",
  failed: "Falló",
  cancelled: "Cancelado",
};

export function isJobStatus(v: unknown): v is JobStatus {
  return typeof v === "string" && (JOB_STATUSES as readonly string[]).includes(v);
}

export function isActiveJob(status: string): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

export const FAILURE_REASONS = ["warping", "atasco", "despegue", "corte_luz", "filamento", "capa", "otro"] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  warping: "Warping (se levantaron las puntas)",
  despegue: "Se despegó de la cama",
  atasco: "Atasco de boquilla",
  filamento: "Filamento cortado o enredado",
  capa: "Capas corridas o delaminadas",
  corte_luz: "Corte de luz",
  otro: "Otro motivo",
};

export function failureReasonLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return (FAILURE_REASON_LABELS as Record<string, string>)[v] ?? v;
}

export const QUOTE_STATUSES = ["pending_review", "priced", "ordered", "expired", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending_review: "Por revisar",
  priced: "Cotizada",
  ordered: "Pedida",
  expired: "Vencida",
  rejected: "Rechazada",
};

export function isQuoteStatus(v: unknown): v is QuoteStatus {
  return typeof v === "string" && (QUOTE_STATUSES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------
// Tiempo
// ---------------------------------------------------------------------

/** 200 → "3 h 20 min"; 45 → "45 min"; 120 → "2 h". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** 200 → "3,3 h" (para cargas y totales, donde el detalle en minutos sobra). */
export function formatHoursShort(minutes: number): string {
  const h = Math.max(0, minutes) / 60;
  return `${h.toLocaleString("es-AR", { maximumFractionDigits: h >= 10 ? 0 : 1 })} h`;
}

/** Fecha `YYYY-MM-DD` de `now` en la zona de la tienda. */
export function todayYmd(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** `YYYY-MM-DD` ± días (calendario, sin zona). */
export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos `YYYY-MM-DD` (b − a). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T12:00:00Z`);
  const tb = Date.parse(`${b}T12:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

/** "jue 9 oct" a partir de `YYYY-MM-DD` (sin corrimiento de zona). */
export function formatYmdShort(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .format(d)
    .replace(/\./g, "")
    .replace(",", "");
}

export type DueState = "none" | "overdue" | "today" | "soon" | "ok";

/** Estado de la fecha comprometida respecto de hoy (`soon` = mañana o pasado). */
export function dueState(due: string | null | undefined, today: string, status?: string): DueState {
  if (!due) return "none";
  if (status === "done" || status === "cancelled") return "ok";
  const d = daysBetween(today, due);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 2) return "soon";
  return "ok";
}

export interface TimedJob {
  status: string;
  est_minutes: number | null;
  started_at: string | null;
}

/**
 * Minutos que le faltan a un trabajo. Imprimiendo: estimado − transcurrido
 * (nunca negativo); en cola: todo lo estimado; el resto: 0.
 */
export function remainingMinutes(job: TimedJob, now: Date = new Date()): number {
  const est = Math.max(0, Number(job.est_minutes ?? 0));
  if (job.status === "queued") return est;
  if (job.status !== "printing") return 0;
  if (!job.started_at) return est;
  const elapsed = (now.getTime() - new Date(job.started_at).getTime()) / 60_000;
  return Math.max(0, est - Math.max(0, elapsed));
}

/** Avance 0–1 de un trabajo imprimiendo (por tiempo). */
export function printProgress(job: TimedJob, now: Date = new Date()): number {
  const est = Number(job.est_minutes ?? 0);
  if (job.status !== "printing" || !job.started_at || est <= 0) return 0;
  const elapsed = (now.getTime() - new Date(job.started_at).getTime()) / 60_000;
  return Math.min(1, Math.max(0, elapsed / est));
}

/** Carga de una impresora: minutos pendientes de sus trabajos en cola o imprimiendo. */
export function printerBacklogMinutes(jobs: readonly (TimedJob & { printer_id: string | null })[], printerId: string, now: Date = new Date()): number {
  let total = 0;
  for (const j of jobs) if (j.printer_id === printerId) total += remainingMinutes(j, now);
  return total;
}

// ---------------------------------------------------------------------
// Sugerir asignación (greedy §3.5)
// ---------------------------------------------------------------------

export interface AssignPrinter {
  id: string;
  bed: [number, number, number];
  materials: readonly string[];
  /** Minutos que ya tiene cargados. */
  backlog_minutes: number;
}

export interface AssignJob {
  id: string;
  minutes: number;
  material_type: MaterialType | null;
  /** Medidas de la pieza (null = no se conoce: entra en cualquiera). */
  bbox: [number, number, number] | null;
}

export interface AssignmentSuggestion {
  assignments: { jobId: string; printerId: string }[];
  /** Trabajos que no entran en ninguna impresora activa (cama o material). */
  unplaceable: string[];
  /** Carga final (minutos) de cada impresora. */
  loads: Record<string, number>;
}

export function printerCanTake(p: Pick<AssignPrinter, "bed" | "materials">, j: Pick<AssignJob, "material_type" | "bbox">): boolean {
  if (j.material_type && !p.materials.includes(j.material_type)) return false;
  if (j.bbox && !fitsPrinter(j.bbox, p.bed)) return false;
  return true;
}

/**
 * Greedy de §3.5: trabajos de mayor a menor duración; cada uno a la impresora
 * compatible con menos carga (empate: la primera de la lista).
 */
export function suggestAssignments(printers: readonly AssignPrinter[], jobs: readonly AssignJob[]): AssignmentSuggestion {
  const loads: Record<string, number> = {};
  for (const p of printers) loads[p.id] = Math.max(0, p.backlog_minutes);
  const sorted = [...jobs].sort((a, b) => b.minutes - a.minutes || a.id.localeCompare(b.id));
  const assignments: AssignmentSuggestion["assignments"] = [];
  const unplaceable: string[] = [];
  for (const j of sorted) {
    let best: AssignPrinter | null = null;
    for (const p of printers) {
      if (!printerCanTake(p, j)) continue;
      if (!best || loads[p.id] < loads[best.id]) best = p;
    }
    if (!best) {
      unplaceable.push(j.id);
      continue;
    }
    loads[best.id] += Math.max(0, j.minutes);
    assignments.push({ jobId: j.id, printerId: best.id });
  }
  return { assignments, unplaceable, loads };
}

// ---------------------------------------------------------------------
// Pedidos → trabajos (agrupados por piezas por plato)
// ---------------------------------------------------------------------

export interface SpecLike {
  product_id: string;
  variant_id: string | null;
  material_id: string;
  color_id: string | null;
  quality_id: string;
  grams_per_unit: number;
  minutes_per_unit: number;
  units_per_plate: number;
  post_minutes: number;
}

export interface OrderItemLike {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  variant_title: string | null;
  qty: number;
}

/** Spec que aplica a una línea: primero la de la variante, después la general del producto. */
export function specForItem<S extends SpecLike>(item: Pick<OrderItemLike, "product_id" | "variant_id">, specs: readonly S[]): S | null {
  if (!item.product_id) return null;
  const mine = specs.filter((s) => s.product_id === item.product_id);
  return (item.variant_id ? mine.find((s) => s.variant_id === item.variant_id) : undefined) ?? mine.find((s) => s.variant_id === null) ?? null;
}

export interface JobDraft {
  order_item_id: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  qty: number;
  material_id: string;
  color_id: string | null;
  quality_id: string;
  est_grams: number;
  est_minutes: number;
  post_minutes: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Una línea del pedido → un trabajo por plato. 10 unidades con 4 por plato
 * = platos de 4, 4 y 2. Gramos, minutos y post-proceso son totales del plato.
 */
export function plateJobsForItem(item: OrderItemLike, spec: SpecLike): JobDraft[] {
  const qty = Math.max(0, Math.floor(item.qty));
  if (!qty) return [];
  const perPlate = Math.max(1, Math.floor(spec.units_per_plate || 1));
  const plates = Math.ceil(qty / perPlate);
  const base = item.variant_title ? `${item.name} · ${item.variant_title}` : item.name;
  const out: JobDraft[] = [];
  for (let i = 0; i < plates; i++) {
    const units = Math.min(perPlate, qty - i * perPlate);
    out.push({
      order_item_id: item.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      title: plates > 1 ? `${base} (plato ${i + 1} de ${plates})` : base,
      qty: units,
      material_id: spec.material_id,
      color_id: spec.color_id,
      quality_id: spec.quality_id,
      est_grams: round2(Number(spec.grams_per_unit) * units),
      est_minutes: round2(Number(spec.minutes_per_unit) * units),
      post_minutes: round2(Number(spec.post_minutes || 0) * units),
    });
  }
  return out;
}

// ---------------------------------------------------------------------
// Costeo (§3.6): de dónde sale el costo por gramo y qué números usar
// ---------------------------------------------------------------------

export interface SpoolCostLike {
  id: string;
  color_id: string;
  cost: number;
  net_grams: number;
}

/** Costo por gramo de un conjunto de bobinas (sólo las que tienen costo cargado). */
export function averageCostPerGram(spools: readonly SpoolCostLike[]): number | null {
  let cost = 0;
  let grams = 0;
  for (const s of spools) {
    const c = Number(s.cost);
    const g = Number(s.net_grams);
    if (c > 0 && g > 0) {
      cost += c;
      grams += g;
    }
  }
  return grams > 0 ? cost / grams : null;
}

/**
 * Costo por gramo para un trabajo: su bobina; si no tiene, el promedio de las
 * bobinas de su color; si no, el del material; si no hay datos, null.
 */
export function costPerGramFor(
  job: { spool_id: string | null; color_id: string | null; material_id: string | null },
  spools: readonly SpoolCostLike[],
  colorMaterial: ReadonlyMap<string, string>,
): number | null {
  if (job.spool_id) {
    const s = spools.find((x) => x.id === job.spool_id);
    if (s) {
      const own = averageCostPerGram([s]);
      if (own !== null) return own;
    }
  }
  if (job.color_id) {
    const byColor = averageCostPerGram(spools.filter((s) => s.color_id === job.color_id));
    if (byColor !== null) return byColor;
  }
  if (job.material_id) {
    const byMaterial = averageCostPerGram(spools.filter((s) => colorMaterial.get(s.color_id) === job.material_id));
    if (byMaterial !== null) return byMaterial;
  }
  return null;
}

export interface CostableJob {
  status: string;
  est_grams: number | null;
  est_minutes: number | null;
  actual_grams: number | null;
  actual_minutes: number | null;
  wasted_grams: number | null;
  post_minutes: number | null;
}

/**
 * Qué números entran al costeo. Terminado: reales (o estimados si faltan).
 * Falló: sólo lo que se tiró y el tiempo que llegó a imprimir. Cancelado: nada.
 */
export function costInputsFor(job: CostableJob): CostInputs | null {
  const n = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));
  if (job.status === "cancelled") return null;
  if (job.status === "failed") {
    return { grams: 0, minutes: n(job.actual_minutes) ?? 0, wasted_grams: n(job.wasted_grams) ?? 0, post_minutes: 0 };
  }
  return {
    grams: n(job.actual_grams) ?? n(job.est_grams) ?? 0,
    minutes: n(job.actual_minutes) ?? n(job.est_minutes) ?? 0,
    wasted_grams: n(job.wasted_grams) ?? 0,
    post_minutes: n(job.post_minutes) ?? 0,
  };
}

/** Margen: `{ amount, pct }` (pct null si no hubo venta). */
export function margin(revenue: number, cost: number): { amount: number; pct: number | null } {
  const amount = revenue - cost;
  return { amount, pct: revenue > 0 ? amount / revenue : null };
}

// ---------------------------------------------------------------------
// Verificación de geometría (archivo real vs lo que declaró el navegador)
// ---------------------------------------------------------------------

export interface GeometryComparison {
  /** Todo dentro de la tolerancia. */
  matches: boolean;
  /** Escala uniforme que aplicó el cliente (1 = sin escalar). */
  scale: number;
  /** Nombre de la conversión de unidades si la escala es una conocida. */
  unitHint: "cm" | "in" | null;
  /** Diferencias relativas (0.05 = 5 %). */
  diffs: { volume: number; area: number; bbox: number; triangles: number };
  maxDiff: number;
}

const relDiff = (a: number, b: number) => {
  const d = Math.max(Math.abs(a), Math.abs(b));
  return d === 0 ? 0 : Math.abs(a - b) / d;
};

/**
 * Compara la geometría declarada (ya escalada a mm) con la del archivo
 * analizado. Detecta la escala uniforme que haya usado el cliente (cm,
 * pulgadas o %) por la medida mayor y compara volumen (f³), área (f²),
 * medidas (ordenadas: tolera que la haya girado) y triángulos.
 */
export function compareGeometry(declared: Geometry, file: Geometry, tolerance = 0.03): GeometryComparison {
  const dSorted = [...declared.bbox].sort((a, b) => a - b);
  const fSorted = [...file.bbox].sort((a, b) => a - b);
  const fMax = fSorted[2];
  const scale = fMax > 0 ? dSorted[2] / fMax : 1;
  const f = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const diffs = {
    volume: relDiff(declared.volume_mm3, file.volume_mm3 * f ** 3),
    area: relDiff(declared.area_mm2, file.area_mm2 * f ** 2),
    bbox: Math.max(relDiff(dSorted[0], fSorted[0] * f), relDiff(dSorted[1], fSorted[1] * f), relDiff(dSorted[2], fSorted[2] * f)),
    triangles: relDiff(declared.triangles, file.triangles),
  };
  const maxDiff = Math.max(diffs.volume, diffs.area, diffs.bbox, diffs.triangles);
  const near = (x: number) => Math.abs(f - x) / x < 0.005;
  return {
    matches: maxDiff <= tolerance,
    scale: near(1) ? 1 : f,
    unitHint: near(10) ? "cm" : near(25.4) ? "in" : null,
    diffs,
    maxDiff,
  };
}

/** Lee un `geometry` jsonb de `print3d_quote_items` (null si no tiene la forma esperada). */
export function parseGeometry(v: unknown): Geometry | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const bbox = o.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 3 || !bbox.every((x) => typeof x === "number" && Number.isFinite(x))) return null;
  const num = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : null);
  const volume = num("volume_mm3");
  const area = num("area_mm2");
  const triangles = num("triangles");
  if (volume === null || area === null || triangles === null) return null;
  return {
    volume_mm3: volume,
    area_mm2: area,
    bbox: [bbox[0], bbox[1], bbox[2]] as [number, number, number],
    triangles,
    manifold: o.manifold === true,
  };
}

/** "120 × 80 × 45 mm" */
export function formatBbox(bbox: readonly number[] | null | undefined): string {
  if (!bbox || bbox.length !== 3) return "—";
  const f = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: n < 10 ? 1 : 0 });
  return `${f(bbox[0])} × ${f(bbox[1])} × ${f(bbox[2])} mm`;
}

/** 1234.5 → "1.235 g"; 0.8 kg y más → "1,2 kg". */
export function formatGrams(grams: number | null | undefined): string {
  if (grams === null || grams === undefined || !Number.isFinite(grams)) return "—";
  if (Math.abs(grams) >= 1000) return `${(grams / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;
  return `${Math.round(grams).toLocaleString("es-AR")} g`;
}
