import "server-only";

import type { AdminContext } from "@/lib/auth";
import { sanitizeSearch } from "@/lib/admin/order-utils";
import {
  ACTIVE_JOB_STATUSES,
  addDaysYmd,
  costInputsFor,
  costPerGramFor,
  isJobStatus,
  isQuoteStatus,
  margin,
  parseGeometry,
  remainingMinutes,
  specForItem,
  todayYmd,
  type JobStatus,
  type QuoteStatus,
  type SpecLike,
} from "@/lib/admin/print3d-production-utils";
import { jobCost, sumCosts } from "@/lib/print3d";
import type { CostBreakdown, Geometry, MaterialType, PriceSettings } from "@/lib/print3d/types";
import { MATERIAL_TYPES } from "@/lib/print3d/types";

/*
 * Taller 3D — lecturas de PRODUCCIÓN del admin (cola, cotizaciones, resumen,
 * panel del pedido). Sin caché, bajo RLS de admin, todo filtrado por la
 * tienda activa. Spec: docs/modules/TALLER-3D.md §2 y §6.
 */

type Supa = AdminContext["supabase"];

export const PRINT3D_FILES_BUCKET = "print3d-files";
/** Vida de las URLs firmadas de descarga (segundos). */
const SIGNED_URL_TTL = 60 * 60;
export const QUOTES_PER_PAGE = 30;

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v, 0));

// ---------------------------------------------------------------------
// Taller: configuración, impresoras, filamento
// ---------------------------------------------------------------------

export interface WorkshopSettings extends PriceSettings {
  enabled: boolean;
  quote_valid_days: number;
  kwh_price: number;
  labor_hour_cost: number;
  daily_print_hours: number;
  post_process_days: number;
  buffer_days: number;
  working_days: number[];
}

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  enabled: true,
  hour_rate: 1500,
  min_piece_price: 1500,
  min_order_price: 5000,
  setup_fee: 0,
  post_process_fee: 0,
  support_extra_pct: 25,
  round_to: 100,
  max_auto_hours: 24,
  quote_valid_days: 7,
  kwh_price: 150,
  labor_hour_cost: 4000,
  daily_print_hours: 18,
  post_process_days: 1,
  buffer_days: 0,
  working_days: [1, 2, 3, 4, 5],
};

export interface Printer {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  bed: [number, number, number];
  materials: MaterialType[];
  watts: number;
  purchase_price: number;
  lifetime_hours: number;
  hours_used: number;
  status: "active" | "maintenance" | "inactive";
  color: string;
  position: number;
}

export interface Material {
  id: string;
  type: MaterialType;
  name: string;
  brand: string | null;
  is_active: boolean;
}

export interface Color {
  id: string;
  material_id: string;
  name: string;
  hex: string;
  is_active: boolean;
}

export interface Quality {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface Spool {
  id: string;
  color_id: string;
  brand: string | null;
  net_grams: number;
  remaining_grams: number;
  cost: number;
  status: "sealed" | "open" | "empty";
}

export interface Workshop {
  settings: WorkshopSettings;
  printers: Printer[];
  materials: Material[];
  colors: Color[];
  qualities: Quality[];
  spools: Spool[];
  timezone: string;
}

function asMaterialType(v: unknown): MaterialType {
  return typeof v === "string" && (MATERIAL_TYPES as readonly string[]).includes(v) ? (v as MaterialType) : "OTRO";
}

export async function getWorkshop(supabase: Supa, storeId: string): Promise<Workshop> {
  const [settingsRes, printersRes, materialsRes, colorsRes, qualitiesRes, spoolsRes, storeRes] = await Promise.all([
    supabase.from("print3d_settings").select("*").eq("store_id", storeId).maybeSingle(),
    supabase.from("print3d_printers").select("*").eq("store_id", storeId).order("position").order("created_at"),
    supabase.from("print3d_materials").select("*").eq("store_id", storeId).order("position").order("created_at"),
    supabase.from("print3d_colors").select("*").eq("store_id", storeId).order("position").order("created_at"),
    supabase.from("print3d_qualities").select("*").eq("store_id", storeId).order("position").order("created_at"),
    supabase.from("print3d_spools").select("*").eq("store_id", storeId).order("created_at"),
    supabase.from("store_settings").select("timezone").eq("store_id", storeId).maybeSingle(),
  ]);

  const s = settingsRes.data;
  const settings: WorkshopSettings = s
    ? {
        enabled: s.enabled,
        hour_rate: num(s.hour_rate),
        min_piece_price: num(s.min_piece_price),
        min_order_price: num(s.min_order_price),
        setup_fee: num(s.setup_fee),
        post_process_fee: num(s.post_process_fee),
        support_extra_pct: num(s.support_extra_pct),
        round_to: num(s.round_to),
        max_auto_hours: num(s.max_auto_hours, 24),
        quote_valid_days: num(s.quote_valid_days, 7),
        kwh_price: num(s.kwh_price),
        labor_hour_cost: num(s.labor_hour_cost),
        daily_print_hours: num(s.daily_print_hours, 18) || 18,
        post_process_days: num(s.post_process_days),
        buffer_days: num(s.buffer_days),
        working_days: Array.isArray(s.working_days) && s.working_days.length ? s.working_days.map((d) => num(d)) : [1, 2, 3, 4, 5],
      }
    : DEFAULT_WORKSHOP_SETTINGS;

  return {
    settings,
    printers: (printersRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      model: p.model,
      bed: [num(p.bed_x), num(p.bed_y), num(p.bed_z)] as [number, number, number],
      materials: (p.materials ?? []).map(asMaterialType),
      watts: num(p.watts),
      purchase_price: num(p.purchase_price),
      lifetime_hours: num(p.lifetime_hours, 5000),
      hours_used: num(p.hours_used),
      status: p.status === "maintenance" || p.status === "inactive" ? p.status : "active",
      color: p.color || "#B02C14",
      position: num(p.position),
    })),
    materials: (materialsRes.data ?? []).map((m) => ({
      id: m.id,
      type: asMaterialType(m.type),
      name: m.name,
      brand: m.brand,
      is_active: m.is_active,
    })),
    colors: (colorsRes.data ?? []).map((c) => ({
      id: c.id,
      material_id: c.material_id,
      name: c.name,
      hex: c.hex || "#999999",
      is_active: c.is_active,
    })),
    qualities: (qualitiesRes.data ?? []).map((q) => ({ id: q.id, code: q.code, name: q.name, is_active: q.is_active })),
    spools: (spoolsRes.data ?? []).map((sp) => ({
      id: sp.id,
      color_id: sp.color_id,
      brand: sp.brand,
      net_grams: num(sp.net_grams, 1000),
      remaining_grams: num(sp.remaining_grams),
      cost: num(sp.cost),
      status: sp.status === "open" || sp.status === "empty" ? sp.status : "sealed",
    })),
    timezone: storeRes.data?.timezone ?? "America/Argentina/Buenos_Aires",
  };
}

/** Datos mínimos para mostrar un trabajo, un color o una bobina en el cliente. */
export interface CatalogRef {
  materials: { id: string; type: MaterialType; name: string }[];
  colors: { id: string; material_id: string; name: string; hex: string }[];
  qualities: { id: string; name: string }[];
}

export function catalogRef(w: Workshop): CatalogRef {
  return {
    materials: w.materials.map((m) => ({ id: m.id, type: m.type, name: m.name })),
    colors: w.colors.map((c) => ({ id: c.id, material_id: c.material_id, name: c.name, hex: c.hex })),
    qualities: w.qualities.map((q) => ({ id: q.id, name: q.name })),
  };
}

/** Gramos disponibles por color (bobinas no vacías). */
export function gramsByColor(spools: readonly Spool[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of spools) {
    if (s.status === "empty") continue;
    out.set(s.color_id, (out.get(s.color_id) ?? 0) + s.remaining_grams);
  }
  return out;
}

export const LOW_STOCK_GRAMS = 250;

// ---------------------------------------------------------------------
// Trabajos
// ---------------------------------------------------------------------

export interface Job {
  id: string;
  title: string;
  qty: number;
  status: JobStatus;
  printer_id: string | null;
  position: number;
  order_id: string | null;
  order_number: number | null;
  order_item_id: string | null;
  quote_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  parent_job_id: string | null;
  material_id: string | null;
  color_id: string | null;
  quality_id: string | null;
  spool_id: string | null;
  est_grams: number | null;
  est_minutes: number | null;
  raw_grams: number | null;
  raw_minutes: number | null;
  actual_grams: number | null;
  actual_minutes: number | null;
  wasted_grams: number;
  post_minutes: number;
  failure_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  /** Medidas de la pieza (sólo trabajos de cotización). */
  bbox: [number, number, number] | null;
}

type JobRow = {
  id: string;
  title: string;
  qty: number;
  status: string;
  printer_id: string | null;
  position: number;
  order_id: string | null;
  order_item_id: string | null;
  quote_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  parent_job_id: string | null;
  material_id: string | null;
  color_id: string | null;
  quality_id: string | null;
  spool_id: string | null;
  est_grams: number | null;
  est_minutes: number | null;
  raw_grams: number | null;
  raw_minutes: number | null;
  actual_grams: number | null;
  actual_minutes: number | null;
  wasted_grams: number | null;
  post_minutes: number | null;
  failure_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
};

/** Completa número de pedido y medidas (cotización) de un lote de trabajos. */
async function hydrateJobs(supabase: Supa, storeId: string, rows: readonly JobRow[]): Promise<Job[]> {
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter((v): v is string => Boolean(v)))];
  const quoteItemIds = [...new Set(rows.map((r) => r.quote_item_id).filter((v): v is string => Boolean(v)))];
  const [orders, qitems] = await Promise.all([
    orderIds.length
      ? supabase.from("orders").select("id, number").eq("store_id", storeId).in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; number: number }[] }),
    quoteItemIds.length
      ? supabase.from("print3d_quote_items").select("id, geometry").eq("store_id", storeId).in("id", quoteItemIds)
      : Promise.resolve({ data: [] as { id: string; geometry: unknown }[] }),
  ]);
  const numbers = new Map((orders.data ?? []).map((o) => [o.id, o.number]));
  const boxes = new Map((qitems.data ?? []).map((q) => [q.id, parseGeometry(q.geometry)?.bbox ?? null]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    qty: num(r.qty, 1),
    status: isJobStatus(r.status) ? r.status : "queued",
    printer_id: r.printer_id,
    position: num(r.position),
    order_id: r.order_id,
    order_number: r.order_id ? (numbers.get(r.order_id) ?? null) : null,
    order_item_id: r.order_item_id,
    quote_item_id: r.quote_item_id,
    product_id: r.product_id,
    variant_id: r.variant_id,
    parent_job_id: r.parent_job_id,
    material_id: r.material_id,
    color_id: r.color_id,
    quality_id: r.quality_id,
    spool_id: r.spool_id,
    est_grams: numOrNull(r.est_grams),
    est_minutes: numOrNull(r.est_minutes),
    raw_grams: numOrNull(r.raw_grams),
    raw_minutes: numOrNull(r.raw_minutes),
    actual_grams: numOrNull(r.actual_grams),
    actual_minutes: numOrNull(r.actual_minutes),
    wasted_grams: num(r.wasted_grams),
    post_minutes: num(r.post_minutes),
    failure_reason: r.failure_reason,
    started_at: r.started_at,
    finished_at: r.finished_at,
    due_date: r.due_date,
    notes: r.notes,
    created_at: r.created_at,
    bbox: r.quote_item_id ? (boxes.get(r.quote_item_id) ?? null) : null,
  }));
}

/** Trabajos del tablero: en cola, imprimiendo o en post-proceso. */
export async function listBoardJobs(supabase: Supa, storeId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from("print3d_jobs")
    .select("*")
    .eq("store_id", storeId)
    .in("status", [...ACTIVE_JOB_STATUSES])
    .order("position")
    .order("created_at");
  if (error) throw new Error(`No se pudo leer la cola: ${error.message}`);
  return hydrateJobs(supabase, storeId, data ?? []);
}

/** Trabajos terminados o fallados desde `sinceIso` (resumen y costeo). */
async function listClosedJobsSince(supabase: Supa, storeId: string, sinceIso: string): Promise<Job[]> {
  const { data } = await supabase
    .from("print3d_jobs")
    .select("*")
    .eq("store_id", storeId)
    .in("status", ["done", "failed"])
    .gte("finished_at", sinceIso)
    .order("finished_at", { ascending: false })
    .limit(1000);
  return hydrateJobs(supabase, storeId, data ?? []);
}

// ---------------------------------------------------------------------
// Pedidos por producir
// ---------------------------------------------------------------------

export interface ProductSpec extends SpecLike {
  id: string;
  made_to_order: boolean;
}

export async function listProductSpecs(supabase: Supa, storeId: string, productIds?: readonly string[]): Promise<ProductSpec[]> {
  let query = supabase.from("print3d_product_specs").select("*").eq("store_id", storeId);
  if (productIds) {
    if (!productIds.length) return [];
    query = query.in("product_id", [...productIds]);
  }
  const { data } = await query;
  return (data ?? []).map((s) => ({
    id: s.id,
    product_id: s.product_id,
    variant_id: s.variant_id,
    material_id: s.material_id,
    color_id: s.color_id,
    quality_id: s.quality_id,
    grams_per_unit: num(s.grams_per_unit),
    minutes_per_unit: num(s.minutes_per_unit),
    units_per_plate: Math.max(1, num(s.units_per_plate, 1)),
    post_minutes: num(s.post_minutes),
    made_to_order: s.made_to_order,
  }));
}

export interface PendingItem {
  id: string;
  name: string;
  variant_title: string | null;
  qty: number;
  plates: number;
  minutes: number;
  grams: number;
  color_id: string | null;
  material_id: string;
}

export interface OrderToProduce {
  id: string;
  number: number;
  status: string;
  payment_status: string;
  customer_name: string;
  created_at: string;
  items: PendingItem[];
}

/** Estados de pedido que ya se pueden producir. Un `pending` sólo si está pagado. */
const PRODUCIBLE_STATUSES = ["pending", "confirmed", "preparing"] as const;

interface PendingLine {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  variant_title: string | null;
  qty: number;
}

/**
 * Líneas de pedidos en curso con producto que se imprime (spec) y sin
 * trabajos (los cancelados no cuentan: si cancelás el trabajo y el pedido
 * sigue vivo, vuelve a aparecer acá).
 */
async function pendingLines(
  supabase: Supa,
  storeId: string,
  orderIds: readonly string[],
): Promise<{ lines: PendingLine[]; specs: ProductSpec[] }> {
  if (!orderIds.length) return { lines: [], specs: [] };
  const { data: items } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, variant_id, name, variant_title, qty")
    .in("order_id", [...orderIds])
    .not("product_id", "is", null);
  const productIds = [...new Set((items ?? []).map((i) => i.product_id).filter((v): v is string => Boolean(v)))];
  const specs = await listProductSpecs(supabase, storeId, productIds);
  const withSpec = (items ?? []).filter((i) => specForItem(i, specs));
  if (!withSpec.length) return { lines: [], specs };
  const { data: jobs } = await supabase
    .from("print3d_jobs")
    .select("order_item_id")
    .eq("store_id", storeId)
    .neq("status", "cancelled")
    .in(
      "order_item_id",
      withSpec.map((i) => i.id),
    );
  const queued = new Set((jobs ?? []).map((j) => j.order_item_id));
  return {
    lines: withSpec.filter((i) => !queued.has(i.id)).map((i) => ({ ...i, qty: num(i.qty, 1) })),
    specs,
  };
}

function toPendingItem(line: PendingLine, spec: SpecLike): PendingItem {
  const perPlate = Math.max(1, spec.units_per_plate);
  return {
    id: line.id,
    name: line.name,
    variant_title: line.variant_title,
    qty: line.qty,
    plates: Math.ceil(line.qty / perPlate),
    minutes: spec.minutes_per_unit * line.qty,
    grams: spec.grams_per_unit * line.qty,
    color_id: spec.color_id,
    material_id: spec.material_id,
  };
}

export async function listOrdersToProduce(supabase: Supa, storeId: string): Promise<OrderToProduce[]> {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, number, status, payment_status, customer, created_at")
    .eq("store_id", storeId)
    .in("status", [...PRODUCIBLE_STATUSES])
    .order("created_at")
    .limit(200);
  const live = (orders ?? []).filter((o) => o.status !== "pending" || o.payment_status === "paid");
  const { lines, specs } = await pendingLines(
    supabase,
    storeId,
    live.map((o) => o.id),
  );
  const out: OrderToProduce[] = [];
  for (const o of live) {
    const items: PendingItem[] = [];
    for (const l of lines) {
      if (l.order_id !== o.id) continue;
      const spec = specForItem(l, specs);
      if (spec) items.push(toPendingItem(l, spec));
    }
    if (!items.length) continue;
    const customer = o.customer && typeof o.customer === "object" && !Array.isArray(o.customer) ? o.customer : {};
    const name = (customer as Record<string, unknown>).name;
    out.push({
      id: o.id,
      number: o.number,
      status: o.status,
      payment_status: o.payment_status,
      customer_name: typeof name === "string" && name ? name : "Cliente",
      created_at: o.created_at,
      items,
    });
  }
  return out;
}

// ---------------------------------------------------------------------
// Costeo
// ---------------------------------------------------------------------

export function costJob(job: Job, w: Workshop): CostBreakdown | null {
  const inputs = costInputsFor(job);
  if (!inputs) return null;
  const colorMaterial = new Map(w.colors.map((c) => [c.id, c.material_id]));
  const printer = job.printer_id ? w.printers.find((p) => p.id === job.printer_id) : undefined;
  return jobCost(inputs, {
    spool_cost_per_gram: costPerGramFor(job, w.spools, colorMaterial),
    printer: printer ? { watts: printer.watts, purchase_price: printer.purchase_price, lifetime_hours: printer.lifetime_hours } : null,
    kwh_price: w.settings.kwh_price,
    labor_hour_cost: w.settings.labor_hour_cost,
  });
}

export function costJobs(jobs: readonly Job[], w: Workshop): CostBreakdown {
  return sumCosts(jobs.map((j) => costJob(j, w)).filter((c): c is CostBreakdown => c !== null));
}

// ---------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------

export interface PrinterLoad {
  printer: Printer;
  /** Minutos pendientes (cola + lo que falta de lo que imprime). */
  backlogMinutes: number;
  current: Job | null;
  queued: number;
}

export interface Overview {
  workshop: Workshop;
  today: string;
  jobs: Job[];
  loads: PrinterLoad[];
  unassigned: Job[];
  /** Trabajos con fecha comprometida hoy o antes. */
  dueToday: Job[];
  pendingQuotes: { id: string; token: string; created_at: string; contactName: string | null; total: number | null; items: number }[];
  pendingQuotesCount: number;
  lowStock: { color: Color; material: Material | null; grams: number }[];
  week: { done: number; failed: number; failRate: number | null; wastedGrams: number; topReason: string | null };
  month: { revenue: number; cost: CostBreakdown; margin: { amount: number; pct: number | null }; jobs: number };
  ordersToProduce: number;
  setupMissing: { printers: boolean; materials: boolean; qualities: boolean };
}

export async function getOverview(supabase: Supa, storeId: string, now: Date = new Date()): Promise<Overview> {
  const workshop = await getWorkshop(supabase, storeId);
  const today = todayYmd(workshop.timezone, now);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [jobs, closed, quotesRes, toProduce] = await Promise.all([
    listBoardJobs(supabase, storeId),
    listClosedJobsSince(supabase, storeId, monthAgo),
    supabase
      .from("print3d_quotes")
      .select("id, token, created_at, contact, total", { count: "exact" })
      .eq("store_id", storeId)
      .eq("status", "pending_review")
      .order("created_at")
      .limit(5),
    listOrdersToProduce(supabase, storeId),
  ]);

  const pendingIds = (quotesRes.data ?? []).map((q) => q.id);
  const { data: qItems } = pendingIds.length
    ? await supabase.from("print3d_quote_items").select("quote_id").eq("store_id", storeId).in("quote_id", pendingIds)
    : { data: [] as { quote_id: string }[] };
  const itemCount = new Map<string, number>();
  for (const it of qItems ?? []) itemCount.set(it.quote_id, (itemCount.get(it.quote_id) ?? 0) + 1);

  const loads: PrinterLoad[] = workshop.printers
    .filter((p) => p.status !== "inactive")
    .map((p) => {
      const mine = jobs.filter((j) => j.printer_id === p.id);
      return {
        printer: p,
        backlogMinutes: mine.reduce((s, j) => s + remainingMinutes(j, now), 0),
        current: mine.find((j) => j.status === "printing") ?? null,
        queued: mine.filter((j) => j.status === "queued").length,
      };
    });

  const grams = gramsByColor(workshop.spools);
  const lowStock = workshop.colors
    .filter((c) => c.is_active)
    .map((c) => ({ color: c, material: workshop.materials.find((m) => m.id === c.material_id) ?? null, grams: grams.get(c.id) ?? 0 }))
    .filter((x) => x.grams < LOW_STOCK_GRAMS && x.material?.is_active !== false)
    .sort((a, b) => a.grams - b.grams);

  const weekJobs = closed.filter((j) => j.finished_at && j.finished_at >= weekAgo);
  const done = weekJobs.filter((j) => j.status === "done").length;
  const failedJobs = weekJobs.filter((j) => j.status === "failed");
  const reasons = new Map<string, number>();
  for (const j of failedJobs) if (j.failure_reason) reasons.set(j.failure_reason, (reasons.get(j.failure_reason) ?? 0) + 1);
  const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const revenue = await revenueForJobs(supabase, closed.filter((j) => j.status === "done"));
  const monthCost = costJobs(closed, workshop);

  const contactName = (c: unknown): string | null => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return null;
    const n = (c as Record<string, unknown>).name;
    return typeof n === "string" && n.trim() ? n.trim() : null;
  };

  return {
    workshop,
    today,
    jobs,
    loads,
    unassigned: jobs.filter((j) => !j.printer_id && j.status === "queued"),
    dueToday: jobs.filter((j) => j.due_date && j.due_date <= today).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    pendingQuotes: (quotesRes.data ?? []).map((q) => ({
      id: q.id,
      token: q.token,
      created_at: q.created_at,
      contactName: contactName(q.contact),
      total: numOrNull(q.total),
      items: itemCount.get(q.id) ?? 0,
    })),
    pendingQuotesCount: quotesRes.count ?? 0,
    lowStock,
    week: {
      done,
      failed: failedJobs.length,
      failRate: done + failedJobs.length > 0 ? failedJobs.length / (done + failedJobs.length) : null,
      wastedGrams: failedJobs.reduce((s, j) => s + j.wasted_grams, 0),
      topReason,
    },
    month: { revenue, cost: monthCost, margin: margin(revenue, monthCost.total), jobs: closed.length },
    ordersToProduce: toProduce.length,
    setupMissing: {
      printers: workshop.printers.length === 0,
      materials: workshop.materials.length === 0,
      qualities: workshop.qualities.length === 0,
    },
  };
}

/**
 * Lo que se cobró por lo que imprimieron estos trabajos: el total de su
 * línea del pedido prorrateado por las piezas del trabajo (un plato de 4 de
 * una línea de 10 se lleva el 40 %). Los reimpresos no suman: la venta es una.
 */
async function revenueForJobs(supabase: Supa, jobs: readonly Job[]): Promise<number> {
  const counted = jobs.filter((j) => j.order_item_id && !j.parent_job_id);
  const ids = [...new Set(counted.map((j) => j.order_item_id as string))];
  if (!ids.length) return 0;
  const { data } = await supabase.from("order_items").select("id, qty, total").in("id", ids);
  const lines = new Map((data ?? []).map((l) => [l.id, { qty: Math.max(1, num(l.qty, 1)), total: num(l.total) }]));
  let revenue = 0;
  for (const j of counted) {
    const line = lines.get(j.order_item_id as string);
    if (line) revenue += (line.total * Math.min(j.qty, line.qty)) / line.qty;
  }
  return revenue;
}

// ---------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------

export interface QuoteContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export function parseContact(v: unknown): QuoteContact {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const s = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : null);
  return { name: s("name"), email: s("email"), phone: s("phone") };
}

export interface QuoteListRow {
  id: string;
  token: string;
  status: QuoteStatus;
  contact: QuoteContact;
  total: number | null;
  created_at: string;
  expires_at: string;
  estimated_ready_date: string | null;
  order_id: string | null;
  order_number: number | null;
  items: number;
  pieces: number;
  reviewItems: number;
  files: string[];
}

export interface QuoteFilters {
  status: QuoteStatus | null;
  q: string;
  page: number;
}

export async function listQuotes(
  supabase: Supa,
  storeId: string,
  f: QuoteFilters,
): Promise<{ rows: QuoteListRow[]; total: number; counts: Record<QuoteStatus | "all", number> }> {
  let query = supabase.from("print3d_quotes").select("*", { count: "exact" }).eq("store_id", storeId);
  if (f.status) query = query.eq("status", f.status);
  const q = sanitizeSearch(f.q);
  if (q) {
    const like = `*${q}*`;
    query = query.or(`contact->>name.ilike.${like},contact->>email.ilike.${like},contact->>phone.ilike.${like},token.ilike.${like}`);
  }
  const from = (Math.max(1, f.page) - 1) * QUOTES_PER_PAGE;
  // Por revisar: primero la más vieja (la que más espera); el resto, la más nueva arriba.
  query = query.order("created_at", { ascending: f.status === "pending_review" }).range(from, from + QUOTES_PER_PAGE - 1);

  const [{ data, count }, countsRes] = await Promise.all([
    query,
    supabase.from("print3d_quotes").select("status").eq("store_id", storeId).limit(5000),
  ]);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const orderIds = rows.map((r) => r.order_id).filter((v): v is string => Boolean(v));
  const [itemsRes, ordersRes] = await Promise.all([
    ids.length
      ? supabase.from("print3d_quote_items").select("quote_id, qty, needs_review, file_name").eq("store_id", storeId).in("quote_id", ids)
      : Promise.resolve({ data: [] as { quote_id: string; qty: number; needs_review: boolean; file_name: string | null }[] }),
    orderIds.length
      ? supabase.from("orders").select("id, number").eq("store_id", storeId).in("id", orderIds)
      : Promise.resolve({ data: [] as { id: string; number: number }[] }),
  ]);
  const numbers = new Map((ordersRes.data ?? []).map((o) => [o.id, o.number]));

  const counts = { all: 0, pending_review: 0, priced: 0, ordered: 0, expired: 0, rejected: 0 } as Record<QuoteStatus | "all", number>;
  for (const r of countsRes.data ?? []) {
    counts.all++;
    if (isQuoteStatus(r.status)) counts[r.status]++;
  }

  return {
    total: count ?? 0,
    counts,
    rows: rows.map((r) => {
      const its = (itemsRes.data ?? []).filter((i) => i.quote_id === r.id);
      return {
        id: r.id,
        token: r.token,
        status: isQuoteStatus(r.status) ? r.status : "pending_review",
        contact: parseContact(r.contact),
        total: numOrNull(r.total),
        created_at: r.created_at,
        expires_at: r.expires_at,
        estimated_ready_date: r.estimated_ready_date,
        order_id: r.order_id,
        order_number: r.order_id ? (numbers.get(r.order_id) ?? null) : null,
        items: its.length,
        pieces: its.reduce((s, i) => s + num(i.qty, 1), 0),
        reviewItems: its.filter((i) => i.needs_review).length,
        files: its.map((i) => i.file_name ?? "archivo"),
      };
    }),
  };
}

export interface QuoteItemDetail {
  id: string;
  position: number;
  file_path: string;
  file_name: string;
  file_size: number | null;
  format: "stl" | "3mf";
  /** URL firmada (1 h) para descargar el archivo del bucket privado. */
  signedUrl: string | null;
  geometry: Geometry | null;
  material_id: string | null;
  color_id: string | null;
  quality_id: string | null;
  infill_pct: number;
  supports: boolean;
  qty: number;
  grams: number | null;
  minutes: number | null;
  unit_price: number | null;
  total: number | null;
  needs_review: boolean;
  review_reasons: string[];
}

export interface QuoteDetail {
  id: string;
  token: string;
  status: QuoteStatus;
  contact: QuoteContact;
  notes: string | null;
  subtotal: number | null;
  setup_fee: number | null;
  min_adjustment: number | null;
  total: number | null;
  estimated_ready_date: string | null;
  expires_at: string;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewer: string | null;
  order_id: string | null;
  order_number: number | null;
  items: QuoteItemDetail[];
}

export async function getQuoteDetail(supabase: Supa, storeId: string, id: string): Promise<QuoteDetail | null> {
  const { data: quote } = await supabase.from("print3d_quotes").select("*").eq("store_id", storeId).eq("id", id).maybeSingle();
  if (!quote) return null;
  const [{ data: items }, orderRes, reviewerRes] = await Promise.all([
    supabase.from("print3d_quote_items").select("*").eq("store_id", storeId).eq("quote_id", id).order("position"),
    quote.order_id
      ? supabase.from("orders").select("number").eq("store_id", storeId).eq("id", quote.order_id).maybeSingle()
      : Promise.resolve({ data: null as { number: number } | null }),
    quote.reviewed_by
      ? supabase.from("profiles").select("name, email").eq("id", quote.reviewed_by).maybeSingle()
      : Promise.resolve({ data: null as { name: string | null; email: string | null } | null }),
  ]);
  const signed = await signFiles(
    supabase,
    storeId,
    (items ?? []).map((i) => i.file_path),
  );
  return {
    id: quote.id,
    token: quote.token,
    status: isQuoteStatus(quote.status) ? quote.status : "pending_review",
    contact: parseContact(quote.contact),
    notes: quote.notes,
    subtotal: numOrNull(quote.subtotal),
    setup_fee: numOrNull(quote.setup_fee),
    min_adjustment: numOrNull(quote.min_adjustment),
    total: numOrNull(quote.total),
    estimated_ready_date: quote.estimated_ready_date,
    expires_at: quote.expires_at,
    created_at: quote.created_at,
    review_note: quote.review_note,
    reviewed_at: quote.reviewed_at,
    reviewer: reviewerRes.data ? (reviewerRes.data.name ?? reviewerRes.data.email ?? null) : null,
    order_id: quote.order_id,
    order_number: orderRes.data?.number ?? null,
    items: (items ?? []).map((i) => ({
      id: i.id,
      position: num(i.position),
      file_path: i.file_path,
      file_name: i.file_name ?? i.file_path.split("/").pop() ?? "archivo",
      file_size: numOrNull(i.file_size),
      format: i.format === "3mf" ? "3mf" : "stl",
      signedUrl: signed.get(i.file_path) ?? null,
      geometry: parseGeometry(i.geometry),
      material_id: i.material_id,
      color_id: i.color_id,
      quality_id: i.quality_id,
      infill_pct: num(i.infill_pct, 20),
      supports: Boolean(i.supports),
      qty: num(i.qty, 1),
      grams: numOrNull(i.grams),
      minutes: numOrNull(i.minutes),
      unit_price: numOrNull(i.unit_price),
      total: numOrNull(i.total),
      needs_review: Boolean(i.needs_review),
      review_reasons: i.review_reasons ?? [],
    })),
  };
}

/**
 * URLs firmadas de archivos del bucket privado. Sólo firma rutas de esta
 * tienda (`<storeId>/…`): la policy de SELECT también lo exige.
 */
async function signFiles(supabase: Supa, storeId: string, paths: readonly string[]): Promise<Map<string, string>> {
  const mine = [...new Set(paths.filter((p) => p.startsWith(`${storeId}/`)))];
  const out = new Map<string, string>();
  if (!mine.length) return out;
  const { data } = await supabase.storage.from(PRINT3D_FILES_BUCKET).createSignedUrls(mine, SIGNED_URL_TTL, { download: true });
  for (const row of data ?? []) {
    if (row.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
  }
  return out;
}

// ---------------------------------------------------------------------
// Panel del pedido
// ---------------------------------------------------------------------

export interface OrderPrint3d {
  workshop: Workshop;
  today: string;
  jobs: Job[];
  costs: Map<string, CostBreakdown>;
  totalCost: CostBreakdown;
  /** Venta de las líneas que se imprimen (o del pedido entero si vino de una cotización). */
  revenue: number;
  margin: { amount: number; pct: number | null };
  pending: PendingItem[];
  canQueue: boolean;
  quote: { id: string; token: string } | null;
  files: { name: string; url: string | null; qty: number }[];
}

export async function getOrderPrint3d(supabase: Supa, storeId: string, orderId: string, now: Date = new Date()): Promise<OrderPrint3d | null> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, payment_status, total, shipping_cost")
    .eq("store_id", storeId)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;

  const [workshop, jobsRes, quoteRes, lines] = await Promise.all([
    getWorkshop(supabase, storeId),
    supabase.from("print3d_jobs").select("*").eq("store_id", storeId).eq("order_id", orderId).order("created_at"),
    supabase.from("print3d_quotes").select("id, token").eq("store_id", storeId).eq("order_id", orderId).maybeSingle(),
    pendingLines(supabase, storeId, [orderId]),
  ]);
  const jobs = await hydrateJobs(supabase, storeId, jobsRes.data ?? []);
  const quote = quoteRes.data;

  let files: OrderPrint3d["files"] = [];
  if (quote) {
    const { data: qItems } = await supabase
      .from("print3d_quote_items")
      .select("file_path, file_name, qty")
      .eq("store_id", storeId)
      .eq("quote_id", quote.id)
      .order("position");
    const signed = await signFiles(
      supabase,
      storeId,
      (qItems ?? []).map((i) => i.file_path),
    );
    files = (qItems ?? []).map((i) => ({ name: i.file_name ?? "archivo", url: signed.get(i.file_path) ?? null, qty: num(i.qty, 1) }));
  }

  const costs = new Map<string, CostBreakdown>();
  for (const j of jobs) {
    const c = costJob(j, workshop);
    if (c) costs.set(j.id, c);
  }
  const totalCost = sumCosts([...costs.values()]);

  // Venta: pedido de cotización → total del pedido sin envío; de catálogo → líneas con trabajos.
  let revenue = 0;
  if (quote) {
    revenue = Math.max(0, num(order.total) - num(order.shipping_cost));
  } else {
    const itemIds = [...new Set(jobs.map((j) => j.order_item_id).filter((v): v is string => Boolean(v)))];
    if (itemIds.length) {
      const { data } = await supabase.from("order_items").select("total").eq("order_id", orderId).in("id", itemIds);
      revenue = (data ?? []).reduce((s, l) => s + num(l.total), 0);
    }
  }

  const pending: PendingItem[] = [];
  for (const l of lines.lines) {
    const spec = specForItem(l, lines.specs);
    if (spec) pending.push(toPendingItem(l, spec));
  }

  if (!jobs.length && !pending.length && !quote) return null;

  return {
    workshop,
    today: todayYmd(workshop.timezone, now),
    jobs,
    costs,
    totalCost,
    revenue,
    margin: margin(revenue, totalCost.total),
    pending,
    canQueue: order.status !== "cancelled" && order.status !== "delivered",
    quote: quote ? { id: quote.id, token: quote.token } : null,
    files,
  };
}

/** Fecha comprometida por defecto para trabajos de catálogo: hoy + días de post-proceso y colchón. */
export function defaultDueDate(w: Workshop, now: Date = new Date()): string {
  return addDaysYmd(todayYmd(w.timezone, now), Math.max(1, w.settings.post_process_days + w.settings.buffer_days + 1));
}
