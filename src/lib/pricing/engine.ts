import { roundMoney, roundPrice } from "@/lib/money";

import { isQuantityType, quantityBadge, quantityHeadline, quantityLineNote } from "./labels";
import type {
  AppliedOffer,
  AppliedPromotion,
  CartItemInput,
  CartLine,
  CartTotals,
  ComputeCartInput,
  Coupon,
  CouponStatus,
  LineOffer,
  PriceResult,
  PricingProduct,
  PricingVariant,
  Promotion,
  QuantityOffer,
  QuantityPromotionType,
  Scope,
} from "./types";

/**
 * Motor de precios PURO (spec §6). Mismas reglas que `create_order` en SQL:
 *
 *   subtotal         = Σ lista × qty
 *   promos por cantidad (bundleDiscount) = Σ lo que bonifica cada 3x2 / N.ª unidad
 *   promoTotal       = Σ (lista − precio con promo por unidad) × qty + bundleDiscount
 *   cupón            = % o fijo sobre las líneas elegibles (ya con promo)
 *   mercadería       = subtotal − promoTotal − cupón
 *   desc. medio pago = round(mercadería × % / 100, 2)
 *   envío            = 0 si cupón free_shipping o mercadería ≥ free_over; si no, costo
 *   total            = mercadería − desc. medio pago + envío
 *
 * Promociones POR UNIDAD (`percent`, `fixed`): se aplican AL LEER (nunca
 * reescriben `price`). Gana la de mayor `priority` (a igual prioridad, la que
 * más descuenta); si esa es `stackable`, se le suman las demás promos
 * acumulables elegibles (en orden de prioridad). Los % se aplican en cascada.
 *
 * Promociones POR CANTIDAD (`bxgy` "Llevá X, pagá Y", `nth_unit_percent`
 * "N.ª unidad al Z %"): se resuelven en el carrito, DESPUÉS de las por unidad
 * y ANTES del cupón y del medio de pago.
 *   - Grupo: todas las unidades del alcance cuentan juntas aunque sean
 *     productos distintos ("llevá 3 de la categoría").
 *   - Grupos: las unidades se ordenan por precio de mayor a menor (a igual
 *     precio, en el orden del carrito) y se parten en grupos de X (bxgy) o de
 *     N (nth) consecutivos. En CADA grupo completo se bonifican las más
 *     baratas: bxgy → las X − Y últimas del grupo, gratis; nth → la última
 *     del grupo, con Z % (precio redondeado con `roundPrice`). Las unidades
 *     que no completan un grupo (las más baratas) se pagan enteras.
 *     Así la regla es monótona: sumar un producto nunca sube el total en más
 *     que su precio (con "las más baratas de TODO el carrito", 3 × $ 100 +
 *     1 × $ 50 con 3x2 costaba $ 300 y sin el de $ 50, $ 200). Con precios
 *     iguales da lo mismo que antes.
 *   - Una unidad participa de UNA sola promo por cantidad (entre varias, gana
 *     la de mayor prioridad y, a igual prioridad, la que más ahorra).
 *   - Con una promo por unidad en la misma línea: si las dos son acumulables,
 *     la promo por cantidad se calcula sobre el precio ya rebajado. Si alguna
 *     no lo es, es la misma regla que entre promos por unidad: gana la de
 *     mayor prioridad y, a igual prioridad, la que más descuenta en ESTE
 *     carrito (se comparan las dos opciones y queda la de menor total). La que
 *     pierde no se aplica a esa línea. Una línea que sólo SUMA unidades para
 *     el grupo (no le toca ninguna bonificada) conserva su promo por unidad.
 *   - Una promo por cantidad que no bonifica ninguna unidad (ej. 2 unidades
 *     con un 3x2) no se aplica y no le saca nada a nadie.
 *   - El descuento por cantidad va A NIVEL PEDIDO (`bundleDiscount`, detalle
 *     en `offers`): la línea conserva su precio unitario real (lista o con
 *     promo por unidad) y las unidades bonificadas se restan una sola vez en
 *     el total. Como cada unidad bonificada vale un precio ya redondeado
 *     (`roundPrice`: al peso en ARS), el descuento es suma de enteros y el
 *     total no deja centavos: 3 × $ 100 con 3x2 → $ 200.
 *     `create_order` lo recibe como `bundle_discount` (migración 0018). Sin
 *     esa migración, `src/lib/store/order-bundle.ts` arma el payload viejo
 *     (precio promedio por línea, redondeado hacia abajo al centavo).
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

function isUnitPromotion(promo: Promotion): boolean {
  return promo.type === "percent" || promo.type === "fixed";
}

/** Promo por cantidad con parámetros válidos (enteros, Y < X, N ≥ 2, 0 < Z ≤ 100). */
function isValidQuantityPromotion(promo: Promotion): boolean {
  if (promo.type === "bxgy") {
    const { buy, pay } = promo;
    return Number.isInteger(buy) && Number.isInteger(pay) && (pay as number) >= 1 && (buy as number) > (pay as number);
  }
  if (promo.type === "nth_unit_percent") {
    return Number.isInteger(promo.nth) && (promo.nth as number) >= 2 && promo.value > 0 && promo.value <= 100;
  }
  return false;
}

/** ¿La promo aplica a este producto ahora? Tipos desconocidos: nunca. */
export function isPromotionEligible(promo: Promotion, product: PricingProduct, now = new Date()): boolean {
  if (!promo.isActive || !inWindow(promo.startsAt, promo.endsAt, now) || !matchesScope(promo.scope, promo, product)) return false;
  if (isUnitPromotion(promo)) return promo.value > 0;
  return isValidQuantityPromotion(promo);
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

interface UnitPricing {
  listPrice: number;
  price: number;
  applied: AppliedPromotion[];
  /** Promo por unidad ganadora (la primera aplicada); null si no hubo descuento. */
  winner: Promotion | null;
}

function priceWithUnitPromotions(listPrice: number, product: PricingProduct, promotions: Promotion[], now: Date): UnitPricing {
  const eligible = promotions
    .filter((p) => isUnitPromotion(p) && isPromotionEligible(p, product, now))
    .sort(byPriority(listPrice));

  const chosen: Promotion[] = [];
  if (eligible.length) {
    const [winner, ...rest] = eligible;
    chosen.push(winner);
    if (winner.stackable) chosen.push(...rest.filter((p) => p.stackable));
  }

  let price = listPrice;
  const applied: AppliedPromotion[] = [];
  let winner: Promotion | null = null;
  for (const promo of chosen) {
    const raw = discountFor(promo, price);
    if (raw <= 0) continue;
    // El precio con promo se redondea a la granularidad de la moneda (sin
    // centavos en ARS), hacia arriba; el descuento aplicado es la diferencia real.
    const next = roundPrice(price - raw);
    const amount = roundMoney(price - next);
    if (amount <= 0) continue;
    price = next;
    winner ??= promo;
    applied.push({ id: promo.id, name: promo.name, badgeLabel: promo.badgeLabel ?? null, amount });
  }
  return { listPrice, price, applied, winner };
}

/** Parte máxima del precio que ahorra una promo por cantidad (3x2 → 1/3; 2.ª al 50 % → 1/4). */
function maxShare(promo: Promotion): number {
  if (promo.type === "bxgy") return ((promo.buy as number) - (promo.pay as number)) / (promo.buy as number);
  if (promo.type === "nth_unit_percent") return Math.min(promo.value, 100) / 100 / (promo.nth as number);
  return 0;
}

function quantityType(promo: Promotion): QuantityPromotionType {
  return promo.type === "bxgy" ? "bxgy" : "nth_unit_percent";
}

/**
 * Promo por cantidad para mostrar en la card y la ficha. Misma regla que el
 * carrito: si choca con la promo por unidad (alguna no es acumulable), gana
 * la de mayor prioridad; a igual prioridad se muestra si su mejor caso
 * ahorra más que el descuento por unidad.
 */
function offerFor(unit: UnitPricing, product: PricingProduct, promotions: Promotion[], now: Date): QuantityOffer | null {
  const candidates = promotions
    .filter((p) => isQuantityType(p.type) && isPromotionEligible(p, product, now))
    .sort((a, b) => b.priority - a.priority || maxShare(b) - maxShare(a) || a.id.localeCompare(b.id));
  const unitShare = unit.listPrice > 0 ? (unit.listPrice - unit.price) / unit.listPrice : 0;
  for (const promo of candidates) {
    const winner = unit.winner;
    const combines = !winner || (winner.stackable && promo.stackable);
    if (!combines && winner) {
      if (winner.priority > promo.priority) continue;
      if (winner.priority === promo.priority && maxShare(promo) <= unitShare) continue;
    }
    return {
      id: promo.id,
      name: promo.name,
      type: quantityType(promo),
      badge: promo.badgeLabel || quantityBadge(promo),
      headline: quantityHeadline(promo),
      combinesWithPrice: combines,
    };
  }
  return null;
}

/**
 * Precio de una variante con promociones (para cards, ficha y carrito). Las
 * promos por cantidad no cambian el precio: vienen en `offer`.
 */
export function applyPromotions(
  variant: PricingVariant,
  product: PricingProduct,
  promotions: Promotion[],
  now = new Date(),
): PriceResult {
  const unit = priceWithUnitPromotions(roundMoney(variant.price), product, promotions, now);
  const { listPrice, price, applied } = unit;

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
    offer: offerFor(unit, product, promotions, now),
  };
}

// ---------------------------------------------------------------------------
// Promos por cantidad en el carrito
// ---------------------------------------------------------------------------

interface WorkLine {
  item: CartItemInput;
  qty: number;
  product: PricingProduct;
  unit: UnitPricing;
  /**
   * La promo por cantidad le ganó a la promo por unidad y bonificó unidades
   * de esta línea: la línea va a precio de lista.
   */
  dropUnit: boolean;
  claim: { promo: Promotion; units: number; discount: number } | null;
}

interface Member {
  line: WorkLine;
  base: number;
  drop: boolean;
}

interface Bundle {
  total: number;
  byLine: Map<WorkLine, { units: number; discount: number }>;
}

/**
 * Bonifica, en cada grupo de X (o N) unidades ordenadas de mayor a menor
 * precio, las más baratas del grupo (ver cabecera). `create_order` repite
 * esta misma regla en SQL (private.compute_bundle_discount, migración 0018).
 */
function bundleDiscount(promo: Promotion, members: Member[]): Bundle {
  const units: { line: WorkLine; base: number; order: number }[] = [];
  members.forEach((m, i) => {
    for (let k = 0; k < m.line.qty; k++) units.push({ line: m.line, base: m.base, order: i });
  });
  // Mayor a menor precio; a igual precio, orden de los miembros (se bonifican las últimas).
  units.sort((a, b) => b.base - a.base || a.order - b.order);
  const size = promo.type === "bxgy" ? (promo.buy as number) : (promo.nth as number);
  const full = Math.floor(units.length / size) * size;
  // Posición dentro del grupo desde la que se bonifica: bxgy → Y (las X − Y últimas); nth → N − 1 (la última).
  const from = promo.type === "bxgy" ? (promo.pay as number) : size - 1;

  const byLine = new Map<WorkLine, { units: number; discount: number }>();
  for (const m of members) byLine.set(m.line, { units: 0, discount: 0 });
  let total = 0;
  for (let k = 0; k < full; k++) {
    if (k % size < from) continue;
    const u = units[k];
    const discount =
      promo.type === "bxgy" ? u.base : roundMoney(u.base - roundPrice((u.base * (100 - Math.min(promo.value, 100))) / 100));
    if (discount <= 0) continue;
    const entry = byLine.get(u.line) as { units: number; discount: number };
    entry.units += 1;
    entry.discount = roundMoney(entry.discount + discount);
    total = roundMoney(total + discount);
  }
  return { total, byLine };
}

interface Evaluation {
  promo: Promotion;
  members: Member[];
  bundle: Bundle;
  /** Ahorro neto: descuento de la promo menos las promos por unidad que se pierden. */
  gain: number;
}

/**
 * Promo por unidad que se pierde al entrar al grupo: sólo en las líneas que
 * reciben alguna unidad bonificada (las que sólo suman unidades la conservan).
 */
const lostUnitDiscount = (members: Member[], bundle: Bundle) =>
  roundMoney(
    members
      .filter((m) => m.drop && (bundle.byLine.get(m.line)?.units ?? 0) > 0)
      .reduce((acc, m) => acc + (m.line.unit.listPrice - m.line.unit.price) * m.line.qty, 0),
  );

function evaluateQuantityPromotion(promo: Promotion, lines: WorkLine[], now: Date): Evaluation | null {
  const keep: WorkLine[] = [];
  const join: WorkLine[] = [];
  const tie: WorkLine[] = [];
  for (const line of lines) {
    if (line.claim || !isPromotionEligible(promo, line.product, now)) continue;
    const winner = line.unit.winner;
    if (!winner || (winner.stackable && promo.stackable)) keep.push(line);
    else if (winner.priority < promo.priority) join.push(line);
    else if (winner.priority === promo.priority) tie.push(line);
    // Prioridad mayor que la promo por cantidad: la línea queda con su promo por unidad.
  }
  const build = (dropped: WorkLine[]): Member[] => [
    ...keep.map((line) => ({ line, base: line.unit.price, drop: false })),
    ...dropped.map((line) => ({ line, base: line.unit.listPrice, drop: true })),
  ];

  const membersA = build(join);
  const bundleA = bundleDiscount(promo, membersA);
  let best: Evaluation = { promo, members: membersA, bundle: bundleA, gain: roundMoney(bundleA.total - lostUnitDiscount(membersA, bundleA)) };
  if (tie.length) {
    const membersB = build([...join, ...tie]);
    const bundleB = bundleDiscount(promo, membersB);
    const gainB = roundMoney(bundleB.total - lostUnitDiscount(membersB, bundleB));
    // A igual prioridad gana la que más descuenta; empate → se queda la promo por unidad.
    if (gainB > best.gain) best = { promo, members: membersB, bundle: bundleB, gain: gainB };
  }
  return best.bundle.total > 0 ? best : null;
}

function applyQuantityPromotions(lines: WorkLine[], promotions: Promotion[], now: Date) {
  let pending = promotions.filter((p) => isQuantityType(p.type) && p.isActive && isValidQuantityPromotion(p) && inWindow(p.startsAt, p.endsAt, now));
  while (pending.length) {
    let best: Evaluation | null = null;
    for (const promo of pending) {
      const ev = evaluateQuantityPromotion(promo, lines, now);
      if (!ev) continue;
      if (
        !best ||
        promo.priority > best.promo.priority ||
        (promo.priority === best.promo.priority && (ev.gain > best.gain || (ev.gain === best.gain && promo.id < best.promo.id)))
      )
        best = ev;
    }
    if (!best) break;
    for (const m of best.members) {
      const share = best.bundle.byLine.get(m.line) ?? { units: 0, discount: 0 };
      m.line.claim = { promo: best.promo, units: share.units, discount: share.discount };
      // Sin unidades bonificadas la línea sólo suma para el grupo: conserva su promo por unidad.
      m.line.dropUnit = m.drop && share.units > 0;
    }
    const chosen = best.promo;
    pending = pending.filter((p) => p !== chosen);
  }
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
  // Sobre lo que paga cada línea después de TODAS las promos (incluida la por cantidad).
  const eligibleSubtotal = roundMoney(
    lines
      .filter((l) => matchesScope(coupon.scope, coupon, { id: l.productId, categoryIds: l.categoryIds }))
      .reduce((acc, l) => acc + l.netTotal, 0),
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

  const work: WorkLine[] = input.items
    .filter((i) => i.qty > 0)
    .map((item) => {
      const product = { id: item.productId, categoryIds: item.categoryIds };
      return {
        item,
        qty: Math.floor(item.qty),
        product,
        unit: priceWithUnitPromotions(roundMoney(item.listPrice), product, promotions, now),
        dropUnit: false,
        claim: null,
      };
    });

  applyQuantityPromotions(work, promotions, now);

  const offers = new Map<string, AppliedOffer>();
  const lines: LineWithCategories[] = work.map((w) => {
    const { item, qty, unit } = w;
    const unitPrice = w.dropUnit ? unit.listPrice : unit.price;
    const lineTotal = roundMoney(unitPrice * qty);
    let offer: LineOffer | null = null;
    if (w.claim) {
      const promo = w.claim.promo;
      // Suma de precios unitarios ya redondeados: entero con precios enteros.
      const amount = roundMoney(Math.min(Math.max(w.claim.discount, 0), lineTotal));
      const label = `Promo ${quantityBadge(promo)}`;
      offer = {
        id: promo.id,
        name: promo.name,
        type: quantityType(promo),
        label,
        note: w.claim.units > 0 ? quantityLineNote(promo, w.claim.units) : `Suma para la ${label}`,
        units: w.claim.units,
        baseUnitPrice: unitPrice,
        amount,
      };
      const agg = offers.get(promo.id) ?? { id: promo.id, name: promo.name, type: quantityType(promo), label, amount: 0 };
      agg.amount = roundMoney(agg.amount + amount);
      offers.set(promo.id, agg);
    }
    return {
      variantId: item.variantId,
      productId: item.productId,
      categoryIds: item.categoryIds,
      qty,
      listPrice: unit.listPrice,
      unitPrice,
      promotion: w.dropUnit ? null : (unit.applied[0] ?? null),
      offer,
      lineList: roundMoney(unit.listPrice * qty),
      lineTotal,
      netTotal: roundMoney(lineTotal - (offer?.amount ?? 0)),
      promoDiscount: roundMoney(unit.listPrice * qty - lineTotal),
    };
  });

  const subtotal = roundMoney(lines.reduce((acc, l) => acc + l.lineList, 0));
  const bundleDiscount = roundMoney(lines.reduce((acc, l) => acc + (l.offer?.amount ?? 0), 0));
  const promoTotal = roundMoney(lines.reduce((acc, l) => acc + l.promoDiscount, 0) + bundleDiscount);
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
    bundleDiscount,
    offers: [...offers.values()].filter((o) => o.amount > 0),
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
