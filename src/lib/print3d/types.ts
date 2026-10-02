/**
 * Taller 3D — tipos del motor (contrato entre storefront, admin y SQL).
 * Spec: docs/modules/TALLER-3D.md §3. Todo en mm, gramos y minutos.
 */

/** Malla triangular cruda: 9 floats por triángulo (x1,y1,z1,x2,…). */
export interface Mesh {
  positions: Float32Array;
  triangles: number;
}

export interface Geometry {
  volume_mm3: number;
  area_mm2: number;
  /** Medidas de la caja contenedora [x, y, z] en mm. */
  bbox: [number, number, number];
  triangles: number;
  /** Cada arista la comparten exactamente 2 triángulos. */
  manifold: boolean;
}

export type ModelFormat = "stl" | "3mf";
export type LengthUnit = "mm" | "cm" | "in";

export const MATERIAL_TYPES = ["PLA", "PETG", "ABS", "ASA", "TPU", "NYLON", "PC", "OTRO"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

/** Parámetros de venta (subset público de print3d_settings). */
export interface PriceSettings {
  hour_rate: number;
  min_piece_price: number;
  min_order_price: number;
  setup_fee: number;
  post_process_fee: number;
  support_extra_pct: number;
  round_to: number;
  max_auto_hours: number;
}

export interface CalendarSettings {
  daily_print_hours: number;
  post_process_days: number;
  buffer_days: number;
  /** ISO: 1 = lunes … 7 = domingo. */
  working_days: number[];
}

export interface PublicSettings extends PriceSettings, CalendarSettings {
  max_file_mb: number;
  quote_valid_days: number;
  intro_md: string;
}

export interface PublicColor {
  id: string;
  name: string;
  hex: string;
  available_grams: number;
}

export interface PublicMaterial {
  id: string;
  type: MaterialType;
  name: string;
  density: number;
  price_per_gram: number;
  speed_factor: number;
  colors: PublicColor[];
}

export interface PublicQuality {
  id: string;
  code: string;
  name: string;
  layer_height: number;
  wall_mm: number;
  throughput_g_h: number;
  price_multiplier: number;
}

export interface Calibration {
  material_id: string;
  quality_id: string;
  grams_factor: number;
  time_factor: number;
  samples: number;
}

export interface PrinterCapacity {
  id: string;
  bed: [number, number, number];
  materials: MaterialType[];
  backlog_minutes: number;
}

export interface MadeToOrderSpec {
  product_id: string;
  variant_id: string | null;
  minutes_per_unit: number;
  units_per_plate: number;
  material_type: MaterialType;
}

/** Respuesta de la RPC `print3d_public_config`. */
export interface PublicConfig {
  settings: PublicSettings;
  materials: PublicMaterial[];
  qualities: PublicQuality[];
  calibration: Calibration[];
  printers: PrinterCapacity[];
  made_to_order: MadeToOrderSpec[];
}

/** Lo que elige el cliente para una pieza. */
export interface ItemChoice {
  material_id: string;
  color_id: string;
  quality_id: string;
  /** 0–100. */
  infill_pct: number;
  supports: boolean;
  qty: number;
}

export interface ItemEstimate {
  /** Por unidad, sin calibrar. */
  raw_grams: number;
  raw_minutes: number;
  /** Por unidad, calibrados. */
  grams: number;
  minutes: number;
  unit_price: number;
  total: number;
}

export const REVIEW_REASONS = ["no_fit", "too_long", "open_mesh", "too_small", "no_stock", "implausible"] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export interface QuoteTotals {
  subtotal: number;
  setup_fee: number;
  min_adjustment: number;
  total: number;
}

export interface ScheduleJob {
  minutes_total: number;
  material_type: MaterialType;
  bbox: [number, number, number];
}

export interface ReadyEstimate {
  /** YYYY-MM-DD */
  date: string;
  /** índice del trabajo → id de impresora */
  assignments: Record<number, string>;
  printHours: number;
}

export interface CostInputs {
  /** Reales si hay; si no, estimados. */
  grams: number;
  minutes: number;
  wasted_grams: number;
  post_minutes: number;
}

export interface CostContext {
  /** null = no se conoce (sin bobinas): el material cuenta 0 e `incomplete`. */
  spool_cost_per_gram: number | null;
  printer: { watts: number; purchase_price: number; lifetime_hours: number } | null;
  kwh_price: number;
  labor_hour_cost: number;
}

export interface CostBreakdown {
  material: number;
  energy: number;
  amortization: number;
  labor: number;
  waste: number;
  total: number;
  incomplete: boolean;
}

export type CalibrationSample = { actual: number; raw: number };

/** Mensaje al worker de parseo (`worker.ts`). */
export interface ParseRequest {
  id: number | string;
  buf: ArrayBuffer;
  fileName: string;
}

/** Respuesta del worker; `positions` llega transferido (para el visor). */
export type ParseResponse =
  | { id: number | string; ok: true; geometry: Geometry; positions: Float32Array }
  | { id: number | string; ok: false; error: string };

/*
 * Firmas que implementa `src/lib/print3d/` (agente B). Los consumidores
 * importan desde "@/lib/print3d" (index.ts reexporta todo):
 *
 *   parseStl(buf: ArrayBuffer): Mesh
 *   parse3mf(buf: ArrayBuffer): Mesh
 *   parseModel(buf: ArrayBuffer, fileName: string): Mesh          // lanza Error con mensaje en castellano
 *   analyzeMesh(mesh: Mesh): Geometry
 *   scaleGeometry(g: Geometry, factor: number): Geometry
 *   unitFactor(unit: LengthUnit): number                          // mm=1, cm=10, in=25.4
 *   suggestUnit(bbox): LengthUnit | null
 *   geometryIsPlausible(g: Geometry): boolean
 *   ceilTo(x: number, r: number): number
 *   calibrationFor(cal: Calibration[], materialId, qualityId): { grams_factor; time_factor }
 *   priceItem(g: Geometry, choice: ItemChoice, ctx: { settings: PriceSettings; material: PublicMaterial; quality: PublicQuality; calibration: Calibration[] }): ItemEstimate
 *   quoteTotals(lineTotals: number[], settings: PriceSettings): QuoteTotals
 *   fitsPrinter(bbox, bed): boolean                               // 6 rotaciones
 *   reviewReasons(g, choice, est: ItemEstimate, ctx: { settings; material; color: PublicColor; printers: PrinterCapacity[] }): ReviewReason[]
 *   REVIEW_REASON_LABELS: Record<ReviewReason, string>
 *   estimateReadyDate(printers: PrinterCapacity[], jobs: ScheduleJob[], cal: CalendarSettings, now?: Date): ReadyEstimate | null
 *   jobCost(inp: CostInputs, ctx: CostContext): CostBreakdown
 *   sumCosts(costs: CostBreakdown[]): CostBreakdown
 *   calibrationFactor(samples: CalibrationSample[]): number
 *
 * Worker (navegador): `new Worker(new URL("@/lib/print3d/worker.ts", import.meta.url))`
 *   postMessage({ id, buf: ArrayBuffer, fileName }) → { id, ok: true, geometry: Geometry, positions: Float32Array } | { id, ok: false, error: string }
 *   (positions se transfiere para el visor; el worker no toca el DOM.)
 */
