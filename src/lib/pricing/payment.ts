import { roundMoney } from "@/lib/money";

/*
 * Helpers de display para el storefront (FEATURES-AUDIT P0-15 y P0-20).
 * Puros: los usa S en cards, ficha, carrito y checkout.
 */

/** Lo mínimo de un método de pago para elegir el mejor descuento. */
export interface PaymentMethodDiscountInput {
  code: string;
  name?: string;
  /** Acepta number o string (numeric de Postgres llega como number, pero por las dudas). */
  discountPercent: number | string;
  /** Si no viene, se asume activo (ej. `getPaymentMethods()` ya filtra los activos). */
  isActive?: boolean;
}

export interface BestPaymentDiscount {
  code: string;
  name: string;
  discountPercent: number;
}

/**
 * Método activo con MAYOR `discount_percent` (> 0), o `null` si ninguno
 * descuenta. Empate: gana el primero de la lista (respetá el orden `position`).
 *
 *   const best = bestPaymentDiscount(await getPaymentMethods());
 *   best && `${formatMoney(priceWithDiscount(price, best.discountPercent))} con ${best.name.toLowerCase()}`
 */
export function bestPaymentDiscount(methods: readonly PaymentMethodDiscountInput[]): BestPaymentDiscount | null {
  let best: BestPaymentDiscount | null = null;
  for (const m of methods) {
    if (m.isActive === false) continue;
    const pct = Number(m.discountPercent);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const clamped = Math.min(pct, 100);
    if (!best || clamped > best.discountPercent) {
      best = { code: m.code, name: m.name ?? m.code, discountPercent: clamped };
    }
  }
  return best;
}

/** Precio con un % de descuento (redondeado a centavos). 10 000 con 10 % → 9 000. */
export function priceWithDiscount(price: number, discountPercent: number): number {
  const pct = Number.isFinite(discountPercent) ? Math.min(Math.max(discountPercent, 0), 100) : 0;
  return roundMoney(Math.max(price, 0) * (1 - pct / 100));
}

/**
 * Precio sin impuestos nacionales (Ley 27.743, Res. SIC 4/2025):
 * `neto = final / (1 + IVA / 100)`, redondeado a 2 decimales.
 * Alícuota 0, negativa o inválida → devuelve el final (redondeado).
 *
 *   netPrice(12100, 21)   → 10000
 *   netPrice(11050, 10.5) → 10000
 */
export function netPrice(finalPrice: number, vatPercent: number | null | undefined): number {
  const price = Number.isFinite(finalPrice) ? finalPrice : 0;
  const vat = Number(vatPercent);
  if (!Number.isFinite(vat) || vat <= 0) return roundMoney(price);
  return roundMoney(price / (1 + vat / 100));
}

/** Alícuota efectiva: la del producto (`products.vat_percent`) o la default de la tienda. */
export function resolveVatPercent(productVat: number | string | null | undefined, defaultVat: number | string | null | undefined): number {
  const own = productVat === null || productVat === undefined || productVat === "" ? Number.NaN : Number(productVat);
  if (Number.isFinite(own) && own >= 0) return own;
  const def = defaultVat === null || defaultVat === undefined || defaultVat === "" ? Number.NaN : Number(defaultVat);
  return Number.isFinite(def) && def >= 0 ? def : 21;
}
