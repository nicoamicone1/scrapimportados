/*
 * Taller 3D — precio de una pieza, totales de la cotización y motivos de
 * revisión manual (spec §3.3 y §3.4). `priceItem` y `quoteTotals` tienen un
 * espejo idéntico en SQL (`private.print3d_price_item`): no cambiar uno sin
 * el otro.
 */
import { fitsPrinter, geometryIsPlausible } from "./geometry";
import { ceilMultiple, round2, roundTo } from "./round";
import {
  REVIEW_REASONS,
  type Calibration,
  type Geometry,
  type ItemChoice,
  type ItemEstimate,
  type PriceSettings,
  type PrinterCapacity,
  type PublicColor,
  type PublicMaterial,
  type PublicQuality,
  type QuoteTotals,
  type ReviewReason,
} from "./types";

/**
 * Redondeo HACIA ARRIBA al múltiplo de `r` (r = 0 → a centavos).
 *   ceilTo(1190.95, 100) → 1200 · ceilTo(1190.951, 0) → 1190.95
 */
export function ceilTo(x: number, r: number): number {
  return r > 0 ? ceilMultiple(x, r) : round2(x);
}

/** Factores de calibración del par material + calidad (sin fila = 1). */
export function calibrationFor(
  cal: Calibration[],
  materialId: string,
  qualityId: string,
): { grams_factor: number; time_factor: number } {
  const row = cal.find((c) => c.material_id === materialId && c.quality_id === qualityId);
  const safe = (f: number | undefined) => (f !== undefined && Number.isFinite(f) && f > 0 ? f : 1);
  return { grams_factor: safe(row?.grams_factor), time_factor: safe(row?.time_factor) };
}

export interface PriceContext {
  settings: PriceSettings;
  material: PublicMaterial;
  quality: PublicQuality;
  calibration: Calibration[];
}

/**
 * Por unidad, geometría en mm:
 *   shell     = min(V, A · paredes)
 *   material  = shell + (V − shell) · relleno/100   (× (1 + soportes%/100))
 *   raw_grams = material/1000 · densidad
 *   raw_min   = raw_grams / (g/h · speed_factor) · 60
 *   grams, minutes = raw × calibración, a 2 decimales ANTES de cotizar
 *   base      = (grams · $/g + minutes/60 · $/h) · multiplicador + post-proceso
 *   unitario  = ceilTo(max(mínimo por pieza, base), redondeo)
 * raw_grams y raw_minutes se guardan redondeados a 2 decimales, pero la
 * calibración se aplica sobre el valor sin redondear.
 */
export function priceItem(g: Geometry, choice: ItemChoice, ctx: PriceContext): ItemEstimate {
  const { settings: s, material: m, quality: q } = ctx;
  const volume = g.volume_mm3;
  const shell = Math.min(volume, g.area_mm2 * q.wall_mm);
  let material = shell + ((volume - shell) * choice.infill_pct) / 100;
  if (choice.supports) material *= 1 + s.support_extra_pct / 100;
  const rawGrams = (material / 1000) * m.density;
  const rawMinutes = (rawGrams / (q.throughput_g_h * m.speed_factor)) * 60;

  const cal = calibrationFor(ctx.calibration, m.id, q.id);
  const grams = round2(rawGrams * cal.grams_factor);
  const minutes = round2(rawMinutes * cal.time_factor);

  const base = (grams * m.price_per_gram + (minutes / 60) * s.hour_rate) * q.price_multiplier + s.post_process_fee;
  const unitPrice = ceilTo(Math.max(s.min_piece_price, base), s.round_to);
  return {
    raw_grams: round2(rawGrams),
    raw_minutes: round2(rawMinutes),
    grams,
    minutes,
    unit_price: unitPrice,
    total: round2(unitPrice * choice.qty),
  };
}

/**
 * subtotal = Σ líneas; preparación fija; ajuste hasta el pedido mínimo.
 * Sin líneas → todo en 0 (no hay nada que ajustar).
 */
export function quoteTotals(lineTotals: number[], settings: PriceSettings): QuoteTotals {
  if (lineTotals.length === 0) return { subtotal: 0, setup_fee: 0, min_adjustment: 0, total: 0 };
  const subtotal = round2(lineTotals.reduce((acc, x) => acc + x, 0));
  const setupFee = round2(settings.setup_fee);
  const minAdjustment = round2(Math.max(0, settings.min_order_price - (subtotal + setupFee)));
  return {
    subtotal,
    setup_fee: setupFee,
    min_adjustment: minAdjustment,
    total: round2(subtotal + setupFee + minAdjustment),
  };
}

/** Por debajo de esto (mm³) no se cotiza automático. */
export const MIN_AUTO_VOLUME_MM3 = 50;
/** Margen de filamento sobre lo estimado para dar stock por bueno. */
export const STOCK_MARGIN = 1.1;

export interface ReviewContext {
  settings: PriceSettings;
  material: PublicMaterial;
  color: PublicColor;
  printers: PrinterCapacity[];
}

/**
 * Motivos por los que la pieza pasa a revisión manual (en el orden de
 * `REVIEW_REASONS`). Las comparaciones limpian el ruido binario (900 · 1,1 da
 * 990.0000000000001 en JS y 990 en SQL).
 */
export function reviewReasons(g: Geometry, choice: ItemChoice, est: ItemEstimate, ctx: ReviewContext): ReviewReason[] {
  const hit: Record<ReviewReason, boolean> = {
    no_fit: !ctx.printers.some((p) => p.materials.includes(ctx.material.type) && fitsPrinter(g.bbox, p.bed)),
    // minutes/60 > max_auto_hours, sin dividir.
    too_long: est.minutes > roundTo(ctx.settings.max_auto_hours * 60, 6),
    open_mesh: !g.manifold,
    too_small: g.volume_mm3 < MIN_AUTO_VOLUME_MM3,
    no_stock: ctx.color.available_grams < roundTo(est.grams * choice.qty * STOCK_MARGIN, 6),
    implausible: !geometryIsPlausible(g),
  };
  return REVIEW_REASONS.filter((r) => hit[r]);
}

/** Textos cortos para el cliente final. */
export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  no_fit: "No entra en nuestras impresoras",
  too_long: "Tarda más de lo que cotizamos automático",
  open_mesh: "La malla tiene agujeros: la revisamos a mano",
  too_small: "Es muy chica para cotizar automático",
  no_stock: "No nos alcanza el filamento de ese color",
  implausible: "El archivo tiene medidas raras",
};
