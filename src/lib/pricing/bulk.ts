import { formatMoney, formatPercent, roundMoney } from "@/lib/money";

/*
 * Cambios masivos de precios (agente C). PURO: la misma función arma la
 * vista previa en el cliente y recalcula en el server antes de aplicar.
 *
 * Orden de operaciones sobre el valor que cambia la regla:
 *   1. cálculo (%, monto, margen, …) → 2. redondeo → 3. tope (mín/máx)
 *   → 4. validación (> 0; tachado > precio).
 * El tope se aplica DESPUÉS del redondeo y no se vuelve a redondear: el
 * límite que pone el usuario es exacto.
 */

export type PriceRounding = "none" | "to10" | "to100" | "to1000" | "end990" | "end99";
export type RoundingDirection = "nearest" | "up" | "down";

export type BulkAction =
  /** Aumentar o bajar un %. `alsoCompareAt`: aplica lo mismo al tachado (si tiene). */
  | { type: "percent"; direction: "increase" | "decrease"; value: number; alsoCompareAt: boolean }
  /** Aumentar o bajar un monto fijo. */
  | { type: "amount"; direction: "increase" | "decrease"; value: number; alsoCompareAt: boolean }
  /** Precio = costo × (1 + margen %). Sin costo → se omite. */
  | { type: "margin"; marginPercent: number }
  /** Tachado = precio actual × (1 + %). El precio no cambia. */
  | { type: "compare_from_price"; percent: number }
  /** Quitar el precio tachado. */
  | { type: "clear_compare" }
  /** Oferta: tachado = precio actual; precio = precio actual × (1 − %). */
  | { type: "sale_from_price"; discountPercent: number };

export type BulkActionType = BulkAction["type"];

export interface BulkRule {
  action: BulkAction;
  rounding: PriceRounding;
  roundingDirection: RoundingDirection;
  /** "No bajar de" (sobre el valor que cambia la regla). */
  min?: number | null;
  /** "No superar". */
  max?: number | null;
}

export interface BulkVariantInput {
  id: string;
  price: number;
  compareAtPrice: number | null;
  cost: number | null;
}

export type BulkSkipReason =
  /** Regla de margen y la variante no tiene costo. */
  | "no_cost"
  /** El precio resultante quedaría en 0 o negativo. */
  | "non_positive"
  /** El tachado resultante no quedaría por encima del precio. */
  | "compare_not_above";

export const SKIP_REASON_LABELS: Record<BulkSkipReason, string> = {
  no_cost: "Sin costo cargado",
  non_positive: "Quedaría en $ 0 o menos",
  compare_not_above: "El tachado no quedaría por encima del precio",
};

export interface BulkChange {
  oldPrice: number;
  newPrice: number;
  oldCompareAt: number | null;
  newCompareAt: number | null;
  /** newPrice − oldPrice */
  priceDiff: number;
  /** % de cambio del precio (0 si el precio era 0). */
  priceDiffPercent: number;
  /** Cambia algo (y no se omitió). */
  changed: boolean;
  skipped: BulkSkipReason | null;
  /** El tope recortó el valor. */
  clamped: "min" | "max" | null;
  /** El tachado se quitó porque quedaba ≤ al precio nuevo. */
  compareCleared: boolean;
}

export type BulkPreviewRow<T extends BulkVariantInput> = BulkChange & { variant: T };

export interface BulkPreviewSummary {
  total: number;
  changed: number;
  unchanged: number;
  skipped: number;
  clamped: number;
  /** Σ precio actual / nuevo de las filas que cambian. */
  oldTotal: number;
  newTotal: number;
  /** Variación % promedio ponderada ((newTotal − oldTotal) / oldTotal). */
  changePercent: number;
}

const EPS = 1e-9;

function roundStep(value: number, step: number, direction: RoundingDirection): number {
  const q = value / step;
  const k = direction === "up" ? Math.ceil(q - EPS) : direction === "down" ? Math.floor(q + EPS) : Math.round(q);
  const out = k * step;
  // Un precio positivo nunca se redondea a 0: se lleva al primer escalón.
  return out <= 0 && value > 0 ? step : out;
}

/** Números de la forma k × modulo + ending (k ≥ 0): 990, 1990, 2990… */
function roundEnding(value: number, modulo: number, ending: number, direction: RoundingDirection): number {
  const q = (value - ending) / modulo;
  let k = direction === "up" ? Math.ceil(q - EPS) : direction === "down" ? Math.floor(q + EPS) : Math.round(q);
  if (k < 0) k = 0; // debajo del primer candidato → el primer candidato
  return k * modulo + ending;
}

/**
 * Redondeo "comercial".
 *   to10/to100/to1000: múltiplo más cercano (o hacia arriba/abajo).
 *   end990: termina en 990 (…, 11 990, 12 990). end99: termina en 99.
 */
export function applyRounding(value: number, rounding: PriceRounding, direction: RoundingDirection = "nearest"): number {
  const v = roundMoney(value);
  switch (rounding) {
    case "to10":
      return roundStep(v, 10, direction);
    case "to100":
      return roundStep(v, 100, direction);
    case "to1000":
      return roundStep(v, 1000, direction);
    case "end990":
      return roundEnding(v, 1000, 990, direction);
    case "end99":
      return roundEnding(v, 100, 99, direction);
    default:
      return v;
  }
}

function clamp(value: number, min: number | null | undefined, max: number | null | undefined) {
  if (max != null && value > max) return { value: roundMoney(max), clamped: "max" as const };
  if (min != null && value < min) return { value: roundMoney(min), clamped: "min" as const };
  return { value, clamped: null };
}

function adjust(value: number, action: Extract<BulkAction, { type: "percent" | "amount" }>): number {
  const sign = action.direction === "increase" ? 1 : -1;
  return action.type === "percent" ? value * (1 + (sign * action.value) / 100) : value + sign * action.value;
}

function money(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? roundMoney(n) : null;
}

/** Calcula el cambio para UNA variante. */
export function computeBulkChange(variant: BulkVariantInput, rule: BulkRule): BulkChange {
  const oldPrice = roundMoney(Number(variant.price) || 0);
  const oldCompareAt = money(variant.compareAtPrice);
  const cost = money(variant.cost);
  const round = (v: number) => applyRounding(v, rule.rounding, rule.roundingDirection);

  const unchanged = (skipped: BulkSkipReason | null = null): BulkChange => ({
    oldPrice,
    newPrice: oldPrice,
    oldCompareAt,
    newCompareAt: oldCompareAt,
    priceDiff: 0,
    priceDiffPercent: 0,
    changed: false,
    skipped,
    clamped: null,
    compareCleared: false,
  });

  let newPrice = oldPrice;
  let newCompareAt = oldCompareAt;
  let clamped: BulkChange["clamped"] = null;
  let compareCleared = false;
  const action = rule.action;

  switch (action.type) {
    case "percent":
    case "amount": {
      const c = clamp(round(adjust(oldPrice, action)), rule.min, rule.max);
      newPrice = c.value;
      clamped = c.clamped;
      if (newPrice <= 0) return unchanged("non_positive");
      if (action.alsoCompareAt && oldCompareAt != null) newCompareAt = round(adjust(oldCompareAt, action));
      break;
    }
    case "margin": {
      if (cost == null || cost <= 0) return unchanged("no_cost");
      const c = clamp(round(cost * (1 + action.marginPercent / 100)), rule.min, rule.max);
      newPrice = c.value;
      clamped = c.clamped;
      if (newPrice <= 0) return unchanged("non_positive");
      break;
    }
    case "compare_from_price": {
      const c = clamp(round(oldPrice * (1 + action.percent / 100)), rule.min, rule.max);
      clamped = c.clamped;
      if (c.value <= oldPrice) return unchanged("compare_not_above");
      newCompareAt = c.value;
      break;
    }
    case "clear_compare": {
      newCompareAt = null;
      break;
    }
    case "sale_from_price": {
      if (oldPrice <= 0) return unchanged("non_positive");
      const c = clamp(round(oldPrice * (1 - action.discountPercent / 100)), rule.min, rule.max);
      if (c.value <= 0) return unchanged("non_positive");
      if (c.value >= oldPrice) return unchanged("compare_not_above");
      newPrice = c.value;
      clamped = c.clamped;
      newCompareAt = oldPrice;
      break;
    }
  }

  // Un tachado que no supera al precio no tiene sentido: se quita.
  if (newCompareAt != null && newCompareAt <= newPrice) {
    newCompareAt = null;
    compareCleared = oldCompareAt != null;
  }

  const priceDiff = roundMoney(newPrice - oldPrice);
  return {
    oldPrice,
    newPrice,
    oldCompareAt,
    newCompareAt,
    priceDiff,
    priceDiffPercent: oldPrice > 0 ? Math.round((priceDiff / oldPrice) * 10000) / 100 : 0,
    changed: newPrice !== oldPrice || newCompareAt !== oldCompareAt,
    skipped: null,
    clamped,
    compareCleared,
  };
}

/**
 * Vista previa de un cambio masivo. Devuelve una fila por variante (en el
 * mismo orden) y un resumen. Las filas con `changed: false` no se aplican.
 */
export function previewBulkUpdate<T extends BulkVariantInput>(
  variants: readonly T[],
  rule: BulkRule,
): { rows: BulkPreviewRow<T>[]; summary: BulkPreviewSummary } {
  const rows = variants.map((variant) => ({ ...computeBulkChange(variant, rule), variant }));
  let changed = 0;
  let skipped = 0;
  let clampedCount = 0;
  let oldTotal = 0;
  let newTotal = 0;
  for (const r of rows) {
    if (r.skipped) skipped++;
    if (r.changed) {
      changed++;
      oldTotal += r.oldPrice;
      newTotal += r.newPrice;
      if (r.clamped) clampedCount++;
    }
  }
  oldTotal = roundMoney(oldTotal);
  newTotal = roundMoney(newTotal);
  return {
    rows,
    summary: {
      total: rows.length,
      changed,
      unchanged: rows.length - changed - skipped,
      skipped,
      clamped: clampedCount,
      oldTotal,
      newTotal,
      changePercent: oldTotal > 0 ? Math.round(((newTotal - oldTotal) / oldTotal) * 10000) / 100 : 0,
    },
  };
}

export const ROUNDING_LABELS: Record<PriceRounding, string> = {
  none: "Sin redondeo",
  to10: "A 10",
  to100: "A 100",
  to1000: "A 1.000",
  end990: "Terminar en 990",
  end99: "Terminar en 99",
};

export const ROUNDING_DIRECTION_LABELS: Record<RoundingDirection, string> = {
  nearest: "al más cercano",
  up: "hacia arriba",
  down: "hacia abajo",
};

/** "Aumentar 10 % (también el tachado) · redondeo a 100 al más cercano · no superar $ 50.000" */
export function describeBulkRule(rule: BulkRule): string {
  const a = rule.action;
  let text: string;
  switch (a.type) {
    case "percent":
      text = `${a.direction === "increase" ? "Aumentar" : "Bajar"} ${formatPercent(a.value)}${a.alsoCompareAt ? " (también el tachado)" : ""}`;
      break;
    case "amount":
      text = `${a.direction === "increase" ? "Aumentar" : "Bajar"} ${formatMoney(a.value)}${a.alsoCompareAt ? " (también el tachado)" : ""}`;
      break;
    case "margin":
      text = `Precio = costo + ${formatPercent(a.marginPercent)} de margen`;
      break;
    case "compare_from_price":
      text = `Tachado = precio + ${formatPercent(a.percent)}`;
      break;
    case "clear_compare":
      text = "Quitar precio tachado";
      break;
    case "sale_from_price":
      text = `Oferta: tachar el precio actual y bajar ${formatPercent(a.discountPercent)}`;
      break;
  }
  const parts = [text];
  if (rule.rounding !== "none" && a.type !== "clear_compare") {
    parts.push(`redondeo ${ROUNDING_LABELS[rule.rounding].toLowerCase()} ${ROUNDING_DIRECTION_LABELS[rule.roundingDirection]}`);
  }
  if (rule.min != null && a.type !== "clear_compare") parts.push(`no bajar de ${formatMoney(rule.min)}`);
  if (rule.max != null && a.type !== "clear_compare") parts.push(`no superar ${formatMoney(rule.max)}`);
  return parts.join(" · ");
}
