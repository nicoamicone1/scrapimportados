import { roundMoney } from "@/lib/money";
import type { CartLine, CartTotals } from "@/lib/pricing";

/*
 * Promos por cantidad (3x2, 2.ª al 50 %) a nivel pedido. Puro: lo usan la
 * acción del checkout (payload de `create_order`) y las vistas del pedido.
 *
 * Desde la migración 0018 `create_order` recibe `bundle_discount` y la línea
 * lleva su precio unitario real; el total queda en pesos enteros
 * (3 × $ 100 con 3x2 → $ 200). Sin esa migración, la función ignora
 * `bundle_discount`: el descuento tiene que viajar metido en el precio de la
 * línea (promedio redondeado hacia abajo al centavo → $ 199,98), como antes.
 */

/** `app_meta.schema_version` desde la que `create_order` acepta `bundle_discount`. */
export const ORDER_BUNDLE_SCHEMA_VERSION = 9;

/** Fila del resumen del pedido para `orders.bundle_discount`. */
export const BUNDLE_DISCOUNT_LABEL = "Promociones por cantidad";

/** ¿La base ya tiene 0018? (`get_schema_version()`; ausente o inválida → no). */
export function supportsOrderBundle(schemaVersion: unknown): boolean {
  return typeof schemaVersion === "number" && Number.isFinite(schemaVersion) && schemaVersion >= ORDER_BUNDLE_SCHEMA_VERSION;
}

/** Hacia abajo al centavo (nunca se cobra más de lo que promete la promo). */
function floorCents(value: number): number {
  return Math.floor(Math.round(value * 1e6) / 1e4) / 100;
}

/**
 * Precio promedio de la línea con la promo por cantidad adentro (payload
 * anterior a 0018): 3 × $ 100 con 3x2 → $ 66,66.
 */
export function averagedUnitPrice(line: Pick<CartLine, "unitPrice" | "qty" | "netTotal" | "offer">): number {
  if (!line.offer || line.offer.amount <= 0 || line.qty <= 0) return line.unitPrice;
  return floorCents(line.netTotal / line.qty);
}

export interface OrderLinesPayload {
  lines: { variant_id: string; unit_price: number }[];
  /** Sólo con 0018: descuento de las promos por cantidad a nivel pedido. */
  bundle_discount?: number;
}

/**
 * `lines` (+ `bundle_discount`) del payload de `create_order`.
 * - `orderLevelBundle` (0018 aplicada): precio real por línea y el descuento
 *   por cantidad aparte.
 * - Si no: precio promedio por línea y sin `bundle_discount`.
 */
export function orderLinesPayload(
  totals: Pick<CartTotals, "lines" | "bundleDiscount">,
  orderLevelBundle: boolean,
): OrderLinesPayload {
  if (orderLevelBundle) {
    return {
      lines: totals.lines.map((l) => ({ variant_id: l.variantId, unit_price: l.unitPrice })),
      bundle_discount: roundMoney(Math.max(totals.bundleDiscount, 0)),
    };
  }
  return { lines: totals.lines.map((l) => ({ variant_id: l.variantId, unit_price: averagedUnitPrice(l) })) };
}

/**
 * Desglose de `orders.promo_total` para mostrar: promos por unidad y por
 * cantidad (`bundle_discount`, ya incluido en `promo_total`). Sin la
 * migración 0018 el campo no viene → todo queda en `unit`, como antes.
 */
export function splitPromotions(
  promoTotal: number,
  bundleDiscount: number | string | null | undefined,
): { unit: number; bundle: number } {
  const total = Number.isFinite(promoTotal) ? Math.max(promoTotal, 0) : 0;
  const raw = Number(bundleDiscount ?? 0);
  const bundle = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), total) : 0;
  return { unit: roundMoney(total - bundle), bundle: roundMoney(bundle) };
}
