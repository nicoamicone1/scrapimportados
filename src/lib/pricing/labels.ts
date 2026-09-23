/*
 * Textos de las promociones (badge, ficha, carrito y admin). Puros: los usan
 * el motor, el storefront y el panel.
 */

import { formatMoney, formatPercent } from "@/lib/money";

import type { Promotion, QuantityPromotionType } from "./types";

type PromoParams = Pick<Promotion, "type" | "value" | "buy" | "pay" | "nth">;

export function isQuantityType(type: string): type is QuantityPromotionType {
  return type === "bxgy" || type === "nth_unit_percent";
}

/** 2 → "2.ª" (ordinal femenino abreviado: "unidad"). */
export function ordinalUnit(n: number): string {
  return `${n}.ª`;
}

/** Badge automático: "3x2", "2.ª al 50 %". */
export function quantityBadge(p: PromoParams): string {
  if (p.type === "bxgy") return `${p.buy ?? 0}x${p.pay ?? 0}`;
  if (p.type === "nth_unit_percent") return `${ordinalUnit(p.nth ?? 2)} al ${formatPercent(p.value)}`;
  return "";
}

/** Línea de la ficha: "Llevá 3 y pagá 2" / "2.ª unidad con 50 % off". */
export function quantityHeadline(p: PromoParams): string {
  if (p.type === "bxgy") return `Llevá ${p.buy ?? 0} y pagá ${p.pay ?? 0}`;
  if (p.type === "nth_unit_percent") {
    const nth = ordinalUnit(p.nth ?? 2);
    return p.value >= 100 ? `La ${nth} unidad, gratis` : `${nth} unidad con ${formatPercent(p.value)} off`;
  }
  return "";
}

/** Nota de la línea del carrito: "1 unidad gratis" / "2.ª unidad −50 %" / "2 unidades −50 %". */
export function quantityLineNote(p: PromoParams, units: number): string {
  if (p.type === "bxgy" || p.value >= 100) return units === 1 ? "1 unidad gratis" : `${units} unidades gratis`;
  const pct = `−${formatPercent(p.value)}`;
  return units === 1 ? `${ordinalUnit(p.nth ?? 2)} unidad ${pct}` : `${units} unidades ${pct}`;
}

/** Vista previa del admin: "Los clientes que lleven 3 pagan 2". */
export function quantityDescription(p: PromoParams): string {
  if (p.type === "bxgy") return `Los clientes que lleven ${p.buy ?? 0} pagan ${p.pay ?? 0}`;
  if (p.type === "nth_unit_percent") {
    const nth = p.nth ?? 2;
    return p.value >= 100
      ? `Los clientes que lleven ${nth} se llevan la ${ordinalUnit(nth)} gratis`
      : `Los clientes que lleven ${nth} tienen ${formatPercent(p.value)} de descuento en la ${ordinalUnit(nth)} unidad`;
  }
  return "";
}

export const PROMOTION_TYPE_LABELS: Record<Promotion["type"], string> = {
  percent: "Porcentaje",
  fixed: "Monto fijo",
  bxgy: "Llevá X, pagá Y",
  nth_unit_percent: "N.ª unidad con descuento",
  unsupported: "Tipo no disponible",
};

/** Columna "Descuento" del listado: "-20 %", "-$ 500", "3x2", "2.ª al 50 %". */
export function promotionValueLabel(p: PromoParams): string {
  if (isQuantityType(p.type)) return quantityBadge(p);
  if (p.type === "fixed") return `-${formatMoney(p.value)}`;
  if (p.type === "percent") return `-${formatPercent(p.value)}`;
  return "—";
}
