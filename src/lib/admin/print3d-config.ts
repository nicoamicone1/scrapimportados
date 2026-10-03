import "server-only";

import { DEFAULT_PRINT3D_SETTINGS, type Print3dSettings } from "@/components/admin/print3d/config/defaults";
import { averageCostPerGram } from "@/components/admin/print3d/config/math";
import type { PrinterStatus, SpoolStatus } from "@/components/admin/print3d/config/presets";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { requireModule } from "@/lib/modules/server";
import { MATERIAL_TYPES, type MaterialType } from "@/lib/print3d/types";

/*
 * Lecturas de la configuración del Taller 3D (agente D1, TALLER-3D §5).
 * Sin caché: el admin siempre lee en vivo. Todo filtra por `store_id`.
 */

export type { Print3dSettings } from "@/components/admin/print3d/config/defaults";

async function print3dCtx(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  requireModule(ctx, "print3d");
  return ctx;
}

const n = (v: number | string | null | undefined, fallback = 0): number => {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
};

function asMaterialType(v: string): MaterialType {
  return (MATERIAL_TYPES as readonly string[]).includes(v) ? (v as MaterialType) : "OTRO";
}

/* ─────────────────────────── Settings ─────────────────────────── */

export async function getPrint3dSettings(): Promise<Print3dSettings & { saved: boolean }> {
  const ctx = await print3dCtx();
  const { data, error } = await ctx.supabase.from("print3d_settings").select("*").eq("store_id", ctx.store.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ...DEFAULT_PRINT3D_SETTINGS, saved: false };
  const d = DEFAULT_PRINT3D_SETTINGS;
  return {
    saved: true,
    enabled: data.enabled,
    hour_rate: n(data.hour_rate, d.hour_rate),
    min_piece_price: n(data.min_piece_price, d.min_piece_price),
    min_order_price: n(data.min_order_price, d.min_order_price),
    setup_fee: n(data.setup_fee),
    post_process_fee: n(data.post_process_fee),
    support_extra_pct: n(data.support_extra_pct, d.support_extra_pct),
    round_to: n(data.round_to, d.round_to),
    max_auto_hours: n(data.max_auto_hours, d.max_auto_hours),
    max_file_mb: n(data.max_file_mb, d.max_file_mb),
    quote_valid_days: n(data.quote_valid_days, d.quote_valid_days),
    kwh_price: n(data.kwh_price, d.kwh_price),
    labor_hour_cost: n(data.labor_hour_cost, d.labor_hour_cost),
    daily_print_hours: n(data.daily_print_hours, d.daily_print_hours),
    post_process_days: n(data.post_process_days, d.post_process_days),
    buffer_days: n(data.buffer_days),
    working_days: Array.isArray(data.working_days) && data.working_days.length ? data.working_days.map(Number) : d.working_days,
    intro_md: data.intro_md ?? "",
  };
}

/* ─────────────────────────── Impresoras ─────────────────────────── */

export interface AdminPrinter {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  bed: [number, number, number];
  nozzle_mm: number;
  materials: MaterialType[];
  watts: number;
  purchase_price: number;
  lifetime_hours: number;
  hours_used: number;
  status: PrinterStatus;
  color: string;
  position: number;
  notes: string | null;
  /** Trabajos en cola o imprimiendo asignados. */
  open_jobs: number;
  /** Trabajos con cualquier estado (historial): si hay, no se borra. */
  total_jobs: number;
}

export async function listPrinters(): Promise<AdminPrinter[]> {
  const ctx = await print3dCtx();
  const [printers, jobs] = await Promise.all([
    ctx.supabase
      .from("print3d_printers")
      .select("id, name, brand, model, bed_x, bed_y, bed_z, nozzle_mm, materials, watts, purchase_price, lifetime_hours, hours_used, status, color, position, notes, created_at")
      .eq("store_id", ctx.store.id)
      .order("position")
      .order("created_at"),
    ctx.supabase.from("print3d_jobs").select("printer_id, status").eq("store_id", ctx.store.id).not("printer_id", "is", null),
  ]);
  if (printers.error) throw new Error(printers.error.message);
  const open = new Map<string, number>();
  const total = new Map<string, number>();
  for (const j of jobs.data ?? []) {
    if (!j.printer_id) continue;
    total.set(j.printer_id, (total.get(j.printer_id) ?? 0) + 1);
    if (j.status === "queued" || j.status === "printing") open.set(j.printer_id, (open.get(j.printer_id) ?? 0) + 1);
  }
  return (printers.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    model: p.model,
    bed: [n(p.bed_x), n(p.bed_y), n(p.bed_z)],
    nozzle_mm: n(p.nozzle_mm, 0.4),
    materials: (p.materials ?? []).map(asMaterialType),
    watts: n(p.watts),
    purchase_price: n(p.purchase_price),
    lifetime_hours: n(p.lifetime_hours, 5000),
    hours_used: n(p.hours_used),
    status: (p.status === "maintenance" || p.status === "inactive" ? p.status : "active") as PrinterStatus,
    color: p.color ?? "#B02C14",
    position: p.position ?? 0,
    notes: p.notes,
    open_jobs: open.get(p.id) ?? 0,
    total_jobs: total.get(p.id) ?? 0,
  }));
}

/* ─────────────────────────── Filamento ─────────────────────────── */

export interface AdminColor {
  id: string;
  material_id: string;
  name: string;
  hex: string;
  is_active: boolean;
  position: number;
  /** Σ gramos restantes de bobinas que no están vacías. */
  grams: number;
}

export interface AdminMaterial {
  id: string;
  type: MaterialType;
  name: string;
  brand: string | null;
  density: number;
  price_per_gram: number;
  speed_factor: number;
  is_active: boolean;
  position: number;
  colors: AdminColor[];
  /** Costo promedio por gramo de sus bobinas con costo cargado. */
  avg_cost_per_gram: number | null;
}

export interface AdminSpool {
  id: string;
  color_id: string;
  brand: string | null;
  net_grams: number;
  remaining_grams: number;
  cost: number;
  status: SpoolStatus;
  purchased_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface FilamentData {
  materials: AdminMaterial[];
  spools: AdminSpool[];
}

export async function getFilamentData(): Promise<FilamentData> {
  const ctx = await print3dCtx();
  const [materials, colors, spools] = await Promise.all([
    ctx.supabase
      .from("print3d_materials")
      .select("id, type, name, brand, density, price_per_gram, speed_factor, is_active, position, created_at")
      .eq("store_id", ctx.store.id)
      .order("position")
      .order("created_at"),
    ctx.supabase
      .from("print3d_colors")
      .select("id, material_id, name, hex, is_active, position, created_at")
      .eq("store_id", ctx.store.id)
      .order("position")
      .order("created_at"),
    ctx.supabase
      .from("print3d_spools")
      .select("id, color_id, brand, net_grams, remaining_grams, cost, status, purchased_at, notes, created_at")
      .eq("store_id", ctx.store.id)
      .order("created_at"),
  ]);
  if (materials.error) throw new Error(materials.error.message);
  if (colors.error) throw new Error(colors.error.message);
  if (spools.error) throw new Error(spools.error.message);

  const spoolRows: AdminSpool[] = (spools.data ?? []).map((s) => ({
    id: s.id,
    color_id: s.color_id,
    brand: s.brand,
    net_grams: n(s.net_grams, 1000),
    remaining_grams: n(s.remaining_grams),
    cost: n(s.cost),
    status: (s.status === "open" || s.status === "empty" ? s.status : "sealed") as SpoolStatus,
    purchased_at: s.purchased_at,
    notes: s.notes,
    created_at: s.created_at,
  }));

  const gramsByColor = new Map<string, number>();
  const spoolsByColor = new Map<string, AdminSpool[]>();
  for (const s of spoolRows) {
    if (s.status !== "empty") gramsByColor.set(s.color_id, (gramsByColor.get(s.color_id) ?? 0) + s.remaining_grams);
    const list = spoolsByColor.get(s.color_id) ?? [];
    list.push(s);
    spoolsByColor.set(s.color_id, list);
  }

  const colorsByMaterial = new Map<string, AdminColor[]>();
  for (const c of colors.data ?? []) {
    const list = colorsByMaterial.get(c.material_id) ?? [];
    list.push({
      id: c.id,
      material_id: c.material_id,
      name: c.name,
      hex: c.hex ?? "#999999",
      is_active: c.is_active,
      position: c.position ?? 0,
      grams: Math.round((gramsByColor.get(c.id) ?? 0) * 10) / 10,
    });
    colorsByMaterial.set(c.material_id, list);
  }

  return {
    spools: spoolRows,
    materials: (materials.data ?? []).map((m) => {
      const mColors = colorsByMaterial.get(m.id) ?? [];
      const mSpools = mColors.flatMap((c) => spoolsByColor.get(c.id) ?? []);
      return {
        id: m.id,
        type: asMaterialType(m.type),
        name: m.name,
        brand: m.brand,
        density: n(m.density, 1.24),
        price_per_gram: n(m.price_per_gram),
        speed_factor: n(m.speed_factor, 1),
        is_active: m.is_active,
        position: m.position ?? 0,
        colors: mColors,
        avg_cost_per_gram: averageCostPerGram(mSpools),
      };
    }),
  };
}

/* ─────────────────────────── Calidades y calibración ─────────────────────────── */

export interface AdminQuality {
  id: string;
  code: string;
  name: string;
  layer_height: number;
  wall_mm: number;
  throughput_g_h: number;
  price_multiplier: number;
  is_active: boolean;
  position: number;
}

export async function listQualities(): Promise<AdminQuality[]> {
  const ctx = await print3dCtx();
  const { data, error } = await ctx.supabase
    .from("print3d_qualities")
    .select("id, code, name, layer_height, wall_mm, throughput_g_h, price_multiplier, is_active, position, created_at")
    .eq("store_id", ctx.store.id)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((q) => ({
    id: q.id,
    code: q.code,
    name: q.name,
    layer_height: n(q.layer_height),
    wall_mm: n(q.wall_mm, 1.2),
    throughput_g_h: n(q.throughput_g_h),
    price_multiplier: n(q.price_multiplier, 1),
    is_active: q.is_active,
    position: q.position ?? 0,
  }));
}

export interface AdminCalibration {
  material_id: string;
  quality_id: string;
  grams_factor: number;
  time_factor: number;
  samples: number;
  updated_at: string | null;
}

export async function listCalibration(): Promise<AdminCalibration[]> {
  const ctx = await print3dCtx();
  const { data, error } = await ctx.supabase
    .from("print3d_calibration")
    .select("material_id, quality_id, grams_factor, time_factor, samples, updated_at")
    .eq("store_id", ctx.store.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    material_id: c.material_id,
    quality_id: c.quality_id,
    grams_factor: n(c.grams_factor, 1),
    time_factor: n(c.time_factor, 1),
    samples: n(c.samples),
    updated_at: c.updated_at,
  }));
}

/* ─────────────────────────── Productos que se imprimen ─────────────────────────── */

export interface AdminProductSpec {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_status: string;
  variant_title: string | null;
  /** Precio de venta de la variante (o el menor del producto si la ficha es para todas). */
  price: number | null;
  material_id: string;
  color_id: string | null;
  quality_id: string;
  grams_per_unit: number;
  minutes_per_unit: number;
  units_per_plate: number;
  post_minutes: number;
  made_to_order: boolean;
}

export async function listProductSpecs(): Promise<AdminProductSpec[]> {
  const ctx = await print3dCtx();
  const { data, error } = await ctx.supabase
    .from("print3d_product_specs")
    .select(
      "id, product_id, variant_id, material_id, color_id, quality_id, grams_per_unit, minutes_per_unit, units_per_plate, post_minutes, made_to_order, created_at",
    )
    .eq("store_id", ctx.store.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  if (!productIds.length) return [];

  const [products, variants] = await Promise.all([
    ctx.supabase.from("products").select("id, name, status").eq("store_id", ctx.store.id).in("id", productIds),
    ctx.supabase
      .from("product_variants")
      .select("id, product_id, title, price, is_active")
      .eq("store_id", ctx.store.id)
      .in("product_id", productIds),
  ]);
  const productById = new Map((products.data ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants.data ?? []).map((v) => [v.id, v]));
  const minPrice = new Map<string, number>();
  for (const v of variants.data ?? []) {
    if (!v.is_active) continue;
    const price = n(v.price);
    const cur = minPrice.get(v.product_id);
    if (cur === undefined || price < cur) minPrice.set(v.product_id, price);
  }

  return rows.map((r) => {
    const product = productById.get(r.product_id);
    const variant = r.variant_id ? variantById.get(r.variant_id) : undefined;
    return {
      id: r.id,
      product_id: r.product_id,
      variant_id: r.variant_id,
      product_name: product?.name ?? "Producto borrado",
      product_status: product?.status ?? "archived",
      variant_title: variant?.title ?? null,
      price: variant ? n(variant.price) : (minPrice.get(r.product_id) ?? null),
      material_id: r.material_id,
      color_id: r.color_id,
      quality_id: r.quality_id,
      grams_per_unit: n(r.grams_per_unit),
      minutes_per_unit: n(r.minutes_per_unit),
      units_per_plate: n(r.units_per_plate, 1),
      post_minutes: n(r.post_minutes),
      made_to_order: r.made_to_order,
    };
  });
}

/* ─────────────────────────── Estado de la puesta en marcha ─────────────────────────── */

export interface Print3dSetupStatus {
  printers: number;
  materials: number;
  qualities: number;
  /** Tiene lo mínimo para cotizar: una impresora, un material y una calidad. */
  ready: boolean;
}

/** Para el Resumen (D2): si da `ready: false`, ofrecer `<SeedDefaultsButton>`. */
export async function getPrint3dSetupStatus(): Promise<Print3dSetupStatus> {
  const ctx = await print3dCtx();
  const count = async (table: "print3d_printers" | "print3d_materials" | "print3d_qualities") => {
    const { count: c } = await ctx.supabase.from(table).select("id", { count: "exact", head: true }).eq("store_id", ctx.store.id);
    return c ?? 0;
  };
  const [printers, materials, qualities] = await Promise.all([
    count("print3d_printers"),
    count("print3d_materials"),
    count("print3d_qualities"),
  ]);
  return { printers, materials, qualities, ready: printers > 0 && materials > 0 && qualities > 0 };
}
