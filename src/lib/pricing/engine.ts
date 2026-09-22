import { roundMoney, roundPrice } from "@/lib/money";

import type {
  AppliedPromotion,
  CartLine,
  CartTotals,
  ComputeCartInput,
  Coupon,
  CouponStatus,
  PriceResult,
  PricingProduct,
  PricingVariant,
  Promotion,
  Scope,
} from "./types";

/**
 * Motor de precios PURO (spec §6). Mismas reglas que `create_order` en SQL:
 *
 *   subtotal         = Σ lista × qty
 *   promoTotal       = Σ (lista − precio con promo) × qty
 *   cupón            = % o fijo sobre las líneas elegibles (ya con promo)
 *   mercadería       = subtotal − promoTotal − cupón
 *   desc. medio pago = round(mercadería × % / 100, 2)
 *   envío            = 0 si cupón free_shipping o mercadería ≥ free_over; si no, costo
 *   total            = mercadería − desc. medio pago + envío
 *
 * Promociones: se aplican AL LEER (nunca reescriben `price`). Gana la de mayor
 * `priority`; si esa es `stackable`, se le suman las demás promos
 * acumulables elegibles (en orden de prioridad). Los % se aplican en cascada.
 */

function inWindow(startsAt: string | null | undefined, endsAt: string | null | undefined, now: Date): boolean {
  const t = now.getTime();
  if (startsAt && new Date(startsAt).getTime() > t) return false;
  if (endsAt && new Date(endsAt).getTime() < t) return false;
  return true;
}

function matchesScope(
  scope: Scope,
  ids: { productIds: string[]; categoryIds: string[] },
  product: PricingProduct,
): boolean {
  if (scope === "all") return true;
  if (scope === "products") return ids.productIds.includes(product.id);
  return product.categoryIds.some((c) => ids.categoryIds.includes(c));
}

/** ¿La promo aplica a este producto ahora? */
export function isPromotionEligible(promo: Promotion, product: PricingProduct, now = new Date()): boolean {
  return promo.isActive && promo.value > 0 && inWindow(promo.startsAt, promo.endsAt, now) && matchesScope(promo.scope, promo, product);
}

function discountFor(promo: Promotion, price: number): number {
  const raw = promo.type === "percent" ? (price * Math.min(promo.value, 100)) / 100 : promo.value;
  return roundMoney(Math.min(Math.max(raw, 0), price));
}

/** Ordena por prioridad desc; empate → mayor descuento sobre `price`, luego id. */
function byPriority(price: number) {
  return (a: Promotion, b: Promotion) =>
    b.priority - a.priority || discountFor(b, price) - discountFor(a, price) || a.id.localeCompare(b.id);
}

/**
 * Precio de una variante con promociones (para cards, ficha y carrito).
 */
export function applyPromotions(
  variant: PricingVariant,
  product: PricingProduct,
  promotions: Promotion[],
  now = new Date(),
): PriceResult {
  const listPrice = roundMoney(variant.price);
  const eligible = promotions.filter((p) => isPromotionEligible(p, product, now)).sort(byPriority(listPrice));

  const chosen: Promotion[] = [];
  if (eligible.length) {
    const [winner, ...rest] = eligible;
    chosen.push(winner);
    if (winner.stackable) chosen.push(...rest.filter((p) => p.stackable));
  }

  let price = listPrice;
  const applied: AppliedPromotion[] = [];
  for (const promo of chosen) {
    const raw = discountFor(promo, price);
    if (raw <= 0) continue;
    // El precio con promo se redondea a la granularidad de la moneda (sin
    // centavos en ARS), hacia arriba; el descuento aplicado es la diferencia real.
    const next = roundPrice(price - raw);
    const amount = roundMoney(price - next);
    if (amount <= 0) continue;
    price = next;
    applied.push({ id: promo.id, name: promo.name, badgeLabel: promo.badgeLabel ?? null, amount });
  }

  const compareAtFromVariant =
    variant.compareAtPrice != null && variant.compareAtPrice > price ? roundMoney(variant.compareAtPrice) : null;
  const compareAt = applied.length ? Math.max(listPrice, compareAtFromVariant ?? 0) : compareAtFromVariant;
  const discountPercent = compareAt && compareAt > 0 ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

  return {
    listPrice,
    price,
    compareAt,
    promotion: applied[0] ?? null,
    promotions: applied,
    discountPercent,
  };
}

/** ¿El cupón está vigente? (las validaciones por uso las hace el server). */
export function isCouponActive(coupon: Coupon, now = new Date()): boolean {
  return (coupon.isActive ?? true) && inWindow(coupon.startsAt, coupon.endsAt, now);
}

type LineWithCategories = CartLine & { categoryIds: string[] };

function applyCoupon(coupon: Coupon, lines: LineWithCategories[], afterPromos: number, now: Date): CouponStatus {
  if (!isCouponActive(coupon, now)) {
    return { applied: false, code: coupon.code, reason: "El cupón no está vigente" };
  }
  if (coupon.minSubtotal != null && afterPromos < coupon.minSubtotal) {
    return { applied: false, code: coupon.code, reason: "No alcanzás la compra mínima del cupón" };
  }
  const eligibleSubtotal = roundMoney(
    lines
      .filter((l) => matchesScope(coupon.scope, coupon, { id: l.productId, categoryIds: l.categoryIds }))
      .reduce((acc, l) => acc + l.lineTotal, 0),
  );
  if (coupon.type === "free_shipping") {
    return { applied: true, code: coupon.code, discount: 0, freeShipping: true, eligibleSubtotal };
  }
  if (eligibleSubtotal <= 0) {
    return { applied: false, code: coupon.code, reason: "El cupón no aplica a los productos del carrito" };
  }
  const discount =
    coupon.type === "percent"
      ? roundMoney((eligibleSubtotal * Math.min(coupon.value, 100)) / 100)
      : roundMoney(Math.min(coupon.value, eligibleSubtotal));
  return { applied: true, code: coupon.code, discount, freeShipping: false, eligibleSubtotal };
}

function stripCategories(line: LineWithCategories): CartLine {
  const { categoryIds, ...rest } = line;
  void categoryIds;
  return rest;
}

/**
 * Totales del carrito/checkout. El cliente lo usa para mostrar; el server lo
 * recalcula antes de `create_order` (y la función SQL vuelve a validar).
 */
export function computeCart(input: ComputeCartInput): CartTotals {
  const now = input.now ?? new Date();
  const promotions = input.promotions ?? [];

  const lines: LineWithCategories[] = input.items
    .filter((i) => i.qty > 0)
    .map((item) => {
      const priced = applyPromotions(
        { id: item.variantId, price: item.listPrice, compareAtPrice: item.compareAtPrice },
        { id: item.productId, categoryIds: item.categoryIds },
        promotions,
        now,
      );
      const qty = Math.floor(item.qty);
      return {
        variantId: item.variantId,
        productId: item.productId,
        categoryIds: item.categoryIds,
        qty,
        listPrice: priced.listPrice,
        unitPrice: priced.price,
        promotion: priced.promotion,
        lineList: roundMoney(priced.listPrice * qty),
        lineTotal: roundMoney(priced.price * qty),
        promoDiscount: roundMoney((priced.listPrice - priced.price) * qty),
      };
    });

  const subtotal = roundMoney(lines.reduce((acc, l) => acc + l.lineList, 0));
  const promoTotal = roundMoney(lines.reduce((acc, l) => acc + l.promoDiscount, 0));
  const afterPromos = roundMoney(subtotal - promoTotal);

  const coupon = input.coupon && lines.length ? applyCoupon(input.coupon, lines, afterPromos, now) : null;
  const couponDiscount = coupon?.applied ? Math.min(coupon.discount, afterPromos) : 0;
  const merchandiseTotal = roundMoney(afterPromos - couponDiscount);

  const paymentDiscountPercent = input.paymentMethod?.discountPercent ?? 0;
  const paymentDiscount = roundMoney((merchandiseTotal * paymentDiscountPercent) / 100);

  let shippingCost = 0;
  let freeShipping = false;
  if (input.shipping) {
    const byCoupon = coupon?.applied === true && coupon.freeShipping;
    const byThreshold = input.shipping.freeOver != null && merchandiseTotal >= input.shipping.freeOver;
    freeShipping = byCoupon || byThreshold;
    shippingCost = freeShipping ? 0 : roundMoney(Math.max(input.shipping.cost, 0));
  }

  const discountTotal = roundMoney(promoTotal + couponDiscount + paymentDiscount);
  const total = roundMoney(merchandiseTotal - paymentDiscount + shippingCost);

  return {
    lines: lines.map(stripCategories),
    subtotal,
    promoTotal,
    couponDiscount,
    coupon,
    merchandiseTotal,
    paymentDiscountPercent,
    paymentDiscount,
    shippingCost,
    freeShipping,
    discountTotal,
    total,
    itemCount: lines.reduce((acc, l) => acc + l.qty, 0),
  };
}
