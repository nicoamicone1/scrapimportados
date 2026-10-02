import {
  estimateReadyDate,
  fitsPrinter,
  priceItem,
  quoteTotals,
  reviewReasons,
  scaleGeometry,
  unitFactor,
} from "@/lib/print3d";
import type {
  Geometry,
  ItemChoice,
  ItemEstimate,
  LengthUnit,
  PrinterCapacity,
  PublicColor,
  PublicConfig,
  PublicMaterial,
  PublicQuality,
  QuoteTotals,
  ReadyEstimate,
  ReviewReason,
} from "@/lib/print3d/types";

/*
 * Cálculo en vivo del cotizador: todo sale del motor (`@/lib/print3d`), la
 * misma fórmula que la RPC usa para guardar. Esto sólo arma los contextos.
 */

export interface PieceInput {
  geometry: Geometry;
  unit: LengthUnit;
  scalePct: number;
  choice: ItemChoice;
}

export interface PieceEval {
  /** Geometría en mm, ya escalada (la que se manda a la RPC). */
  geometry: Geometry;
  factor: number;
  material: PublicMaterial;
  color: PublicColor;
  quality: PublicQuality;
  estimate: ItemEstimate;
  reasons: ReviewReason[];
}

export function scaleFactor(unit: LengthUnit, scalePct: number): number {
  return unitFactor(unit) * (scalePct / 100);
}

export function evaluatePiece(piece: PieceInput, config: PublicConfig): PieceEval | null {
  const material = config.materials.find((m) => m.id === piece.choice.material_id);
  const color = material?.colors.find((c) => c.id === piece.choice.color_id);
  const quality = config.qualities.find((q) => q.id === piece.choice.quality_id);
  if (!material || !color || !quality) return null;
  const factor = scaleFactor(piece.unit, piece.scalePct);
  const geometry = scaleGeometry(piece.geometry, factor);
  const estimate = priceItem(geometry, piece.choice, { settings: config.settings, material, quality, calibration: config.calibration });
  const reasons = reviewReasons(geometry, piece.choice, estimate, { settings: config.settings, material, color, printers: config.printers });
  return { geometry, factor, material, color, quality, estimate, reasons };
}

export interface QuoteSummary {
  totals: QuoteTotals;
  ready: ReadyEstimate | null;
  grams: number;
  minutes: number;
  pieces: number;
}

export function summarize(evals: PieceEval[], qtys: number[], config: PublicConfig, now: Date = new Date()): QuoteSummary {
  const totals = quoteTotals(
    evals.map((e) => e.estimate.total),
    config.settings,
  );
  const ready = evals.length
    ? estimateReadyDate(
        config.printers,
        evals.map((e, i) => ({ minutes_total: e.estimate.minutes * qtys[i], material_type: e.material.type, bbox: e.geometry.bbox })),
        config.settings,
        now,
      )
    : null;
  return {
    totals,
    ready,
    grams: evals.reduce((s, e, i) => s + e.estimate.grams * qtys[i], 0),
    minutes: evals.reduce((s, e, i) => s + e.estimate.minutes * qtys[i], 0),
    pieces: qtys.reduce((s, q) => s + q, 0),
  };
}

const volume = (b: readonly number[]) => b[0] * b[1] * b[2];

/** Cama más grande de las impresoras que imprimen ese material (o de todas). */
export function biggestBed(printers: PrinterCapacity[], materialType?: string): [number, number, number] | null {
  const pool = materialType ? printers.filter((p) => p.materials.includes(materialType as PrinterCapacity["materials"][number])) : [];
  const list = pool.length ? pool : printers;
  if (!list.length) return null;
  return list.reduce((a, b) => (volume(b.bed) > volume(a.bed) ? b : a)).bed;
}

/** ¿Entra en alguna impresora? (para el detalle de `no_fit`). */
export function fitsAny(printers: PrinterCapacity[], bbox: [number, number, number]): boolean {
  return printers.some((p) => fitsPrinter(bbox, p.bed));
}

/** Elección inicial: primer material con stock, color con stock, calidad "standard". */
export function defaultChoice(config: PublicConfig, previous?: ItemChoice | null): ItemChoice | null {
  if (previous && config.materials.some((m) => m.id === previous.material_id)) return { ...previous, qty: 1 };
  const withColors = config.materials.filter((m) => m.colors.length);
  const material = withColors.find((m) => m.colors.some((c) => c.available_grams > 0)) ?? withColors[0];
  const color = material?.colors.find((c) => c.available_grams > 0) ?? material?.colors[0];
  const quality =
    config.qualities.find((q) => q.code === "standard") ?? config.qualities[Math.floor(config.qualities.length / 2)] ?? config.qualities[0];
  if (!material || !color || !quality) return null;
  return { material_id: material.id, color_id: color.id, quality_id: quality.id, infill_pct: 20, supports: false, qty: 1 };
}

/** ¿Alcanza el stock de este color para `grams × qty` (con 10 % de margen, como `no_stock`)? */
export function colorHasStock(color: PublicColor, grams: number, qty: number): boolean {
  return color.available_grams >= grams * qty * 1.1;
}
