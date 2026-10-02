/**
 * Cuentas de la configuración del taller (puras, sin DB). Todo el precio y
 * el costo salen del motor `@/lib/print3d` para que el admin muestre
 * exactamente lo mismo que cotiza la tienda.
 */
import { jobCost, priceItem } from "@/lib/print3d";
import type {
  Calibration,
  CostBreakdown,
  Geometry,
  ItemEstimate,
  MaterialType,
  PriceSettings,
  PublicMaterial,
  PublicQuality,
} from "@/lib/print3d/types";

export interface MachineInputs {
  watts: number;
  purchase_price: number;
  lifetime_hours: number;
}

/** Lo que te cuesta una hora de máquina: energía + amortización (§3.6). */
export function machineHourCost(printer: MachineInputs, kwhPrice: number): { energy: number; amortization: number; total: number } {
  const c = jobCost(
    { grams: 0, minutes: 60, wasted_grams: 0, post_minutes: 0 },
    { spool_cost_per_gram: 0, printer, kwh_price: kwhPrice, labor_hour_cost: 0 },
  );
  return { energy: c.energy, amortization: c.amortization, total: c.energy + c.amortization };
}

/**
 * Geometría sintética de una pieza maciza de `grams` gramos: con relleno
 * 100 % la fórmula §3.3 da exactamente esos gramos crudos, sin importar
 * paredes ni área.
 */
export function solidGeometryForGrams(grams: number, density: number): Geometry {
  const volume = density > 0 ? (grams / density) * 1000 : 0;
  const side = Math.cbrt(Math.max(volume, 0));
  return {
    volume_mm3: volume,
    area_mm2: 6 * side * side,
    bbox: [side, side, side],
    triangles: 12,
    manifold: true,
  };
}

export interface SimulationInput {
  grams: number;
  material: PublicMaterial;
  quality: PublicQuality;
  settings: PriceSettings;
  calibration: Calibration[];
}

export interface Simulation extends ItemEstimate {
  /** Parte del precio que es material (antes de multiplicador y mínimos). */
  materialPart: number;
  /** Parte del precio que es tiempo de máquina. */
  machinePart: number;
  /** El mínimo por pieza le ganó a la fórmula. */
  hitMinimum: boolean;
}

/** "Una pieza de 100 g en PLA estándar sale $ X y tarda Y h". */
export function simulatePiece({ grams, material, quality, settings, calibration }: SimulationInput): Simulation {
  const g = solidGeometryForGrams(grams, material.density);
  const est = priceItem(
    g,
    { material_id: material.id, color_id: "", quality_id: quality.id, infill_pct: 100, supports: false, qty: 1 },
    { settings, material, quality, calibration },
  );
  const materialPart = est.grams * material.price_per_gram * quality.price_multiplier;
  const machinePart = (est.minutes / 60) * settings.hour_rate * quality.price_multiplier;
  const base = materialPart + machinePart + settings.post_process_fee;
  return { ...est, materialPart, machinePart, hitMinimum: settings.min_piece_price > base };
}

export interface SpoolCostInput {
  cost: number;
  net_grams: number;
}

/** Costo promedio por gramo (ponderado por gramos netos) de las bobinas con costo cargado. */
export function averageCostPerGram(spools: SpoolCostInput[]): number | null {
  let cost = 0;
  let grams = 0;
  for (const s of spools) {
    if (s.cost > 0 && s.net_grams > 0) {
      cost += s.cost;
      grams += s.net_grams;
    }
  }
  return grams > 0 ? cost / grams : null;
}

/** Precio de venta sugerido por gramo: costo × margen, redondeado a $ 0,50. */
export function suggestedPricePerGram(costPerGram: number, margin: number): number {
  return Math.ceil(costPerGram * margin * 2) / 2;
}

/** Proporción 0..1 de una bobina (para la barra). */
export function spoolFill(remaining: number, net: number): number {
  if (!(net > 0)) return 0;
  return Math.min(1, Math.max(0, remaining / net));
}

/** Minutos estimados para `grams` gramos con una calidad y material (sin calibración: la aplica `calibrationFactor`). */
export function estimateMinutes(grams: number, quality: { throughput_g_h: number }, material: { speed_factor: number }, timeFactor = 1): number {
  const rate = quality.throughput_g_h * material.speed_factor;
  if (!(rate > 0)) return 0;
  return Math.round((grams / rate) * 60 * timeFactor * 100) / 100;
}

export interface UnitCostInput {
  grams: number;
  minutes: number;
  post_minutes: number;
}

/** Costo por unidad de un producto del catálogo (§3.6): gramos, minutos y post-proceso ya son por unidad. */
export function unitCost(
  input: UnitCostInput,
  ctx: { spool_cost_per_gram: number | null; printer: MachineInputs | null; kwh_price: number; labor_hour_cost: number },
): CostBreakdown {
  return jobCost(
    { grams: input.grams, minutes: input.minutes, wasted_grams: 0, post_minutes: input.post_minutes },
    ctx,
  );
}

/** Elige la impresora para costear: la primera activa que imprime ese tipo (o cualquiera activa). */
export function pickPrinterFor<T extends { status: string; materials: string[] }>(printers: T[], type: MaterialType): T | null {
  const active = printers.filter((p) => p.status === "active");
  return active.find((p) => p.materials.includes(type)) ?? active[0] ?? printers[0] ?? null;
}
