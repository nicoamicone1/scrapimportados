/**
 * Tipos del motor de precios. Son independientes de la DB (camelCase) para
 * que el motor sea puro y testeable; `fromRow` convierte filas de Supabase.
 */

export type Scope = "all" | "categories" | "products";

/**
 * - `percent` / `fixed`: descuento POR UNIDAD (baja el precio de la card).
 * - `bxgy`: "Llevá X, pagá Y" (3x2, 2x1…): por cada X unidades del alcance,
 *   X − Y salen gratis. `value` no se usa (0).
 * - `nth_unit_percent`: "N.ª unidad al Z %": cada N unidades del alcance, una
 *   tiene `value` % de descuento.
 * Las dos últimas son promos POR CANTIDAD: se resuelven en el carrito
 * (`computeCart`), nunca bajan el precio unitario de la card.
 * `unsupported`: tipo que esta versión no conoce (o parámetros inválidos): el
 * motor lo ignora.
 */
export type PromotionType = "percent" | "fixed" | "bxgy" | "nth_unit_percent";
export type QuantityPromotionType = "bxgy" | "nth_unit_percent";

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType | "unsupported";
  value: number;
  /** bxgy: unidades que se llevan (X ≥ 2). */
  buy?: number | null;
  /** bxgy: unidades que se pagan (1 ≤ Y < X). */
  pay?: number | null;
  /** nth_unit_percent: cada cuántas unidades una tiene descuento (N ≥ 2). */
  nth?: number | null;
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  priority: number;
  badgeLabel?: string | null;
  stackable: boolean;
}

export interface Coupon {
  code: string;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minSubtotal?: number | null;
  scope: Scope;
  categoryIds: string[];
  productIds: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
}

export interface PaymentMethodPricing {
  code: string;
  discountPercent: number;
}

export interface ShippingPricing {
  cost: number;
  /** Envío gratis si la mercadería (después de promos y cupón) alcanza este monto. */
  freeOver?: number | null;
}

/** Lo mínimo del producto que necesita el motor. */
export interface PricingProduct {
  id: string;
  categoryIds: string[];
}

/** Lo mínimo de la variante que necesita el motor. */
export interface PricingVariant {
  id: string;
  price: number;
  compareAtPrice?: number | null;
}

export interface AppliedPromotion {
  id: string;
  name: string;
  badgeLabel: string | null;
  /** Descuento por unidad que aportó esta promo. */
  amount: number;
}

/** Promo por cantidad que aplica a un producto (para el badge y la ficha). */
export interface QuantityOffer {
  id: string;
  name: string;
  type: QuantityPromotionType;
  /** `badge_label` o el automático ("3x2", "2.ª al 50 %"). */
  badge: string;
  /** "Llevá 3 y pagá 2" / "2.ª unidad con 50 % off". */
  headline: string;
  /** false: no se suma al descuento por unidad que muestra el precio. */
  combinesWithPrice: boolean;
}

export interface PriceResult {
  /** Precio de lista (variant.price). */
  listPrice: number;
  /** Precio final con promociones. */
  price: number;
  /** Precio "antes" para tachar: lista si hay promo, o compare_at si es mayor. */
  compareAt: number | null;
  /** Promo principal (la de mayor prioridad) — para el badge. */
  promotion: AppliedPromotion | null;
  /** Todas las promos aplicadas (más de una sólo si son acumulables). */
  promotions: AppliedPromotion[];
  /** % de descuento total redondeado (para badges "-20 %"). */
  discountPercent: number;
  /** Promo por cantidad que se le puede aplicar en el carrito (no cambia `price`). */
  offer: QuantityOffer | null;
}

export interface CartItemInput {
  variantId: string;
  productId: string;
  categoryIds: string[];
  qty: number;
  /** Precio de lista de la variante. */
  listPrice: number;
  compareAtPrice?: number | null;
}

/** Parte de una promo por cantidad que le tocó a una línea del carrito. */
export interface LineOffer {
  id: string;
  name: string;
  type: QuantityPromotionType;
  /** "Promo 3x2" (la misma etiqueta que la línea del resumen). */
  label: string;
  /** "1 unidad gratis" / "2.ª unidad −50 %". */
  note: string;
  /** Unidades de esta línea bonificadas (gratis o con el %). */
  units: number;
  /** Precio unitario antes de la promo por cantidad (lista o con promo por unidad). */
  baseUnitPrice: number;
  /** Descuento de la promo por cantidad en esta línea. */
  amount: number;
}

export interface CartLine {
  variantId: string;
  productId: string;
  qty: number;
  listPrice: number;
  /**
   * Precio unitario final. Con una promo por cantidad es el PROMEDIO de la
   * línea, redondeado hacia abajo al centavo (así `create_order` recibe un
   * `unit_price` por línea y el total coincide con lo que se mostró).
   */
  unitPrice: number;
  promotion: AppliedPromotion | null;
  /** Promo por cantidad (3x2, 2.ª al 50 %) que bonificó unidades de esta línea. */
  offer: LineOffer | null;
  /** listPrice * qty */
  lineList: number;
  /** unitPrice * qty */
  lineTotal: number;
  /** (listPrice - unitPrice) * qty */
  promoDiscount: number;
}

/** Línea del resumen: "Promo 3x2: −$ X". */
export interface AppliedOffer {
  id: string;
  name: string;
  type: QuantityPromotionType;
  label: string;
  amount: number;
}

export type CouponStatus =
  | { applied: true; code: string; discount: number; freeShipping: boolean; eligibleSubtotal: number }
  | { applied: false; code: string; reason: string };

export interface CartTotals {
  lines: CartLine[];
  /** Σ listPrice × qty */
  subtotal: number;
  /** Σ (listPrice − unitPrice) × qty (promos por unidad + por cantidad). */
  promoTotal: number;
  /** Promos por cantidad aplicadas (ya incluidas en `promoTotal`). */
  offers: AppliedOffer[];
  couponDiscount: number;
  coupon: CouponStatus | null;
  /** Base sobre la que se aplica el % del método de pago: subtotal − promos − cupón. */
  merchandiseTotal: number;
  paymentDiscountPercent: number;
  paymentDiscount: number;
  shippingCost: number;
  freeShipping: boolean;
  /** promo + cupón + método de pago */
  discountTotal: number;
  total: number;
  itemCount: number;
}

export interface ComputeCartInput {
  items: CartItemInput[];
  promotions?: Promotion[];
  coupon?: Coupon | null;
  paymentMethod?: PaymentMethodPricing | null;
  shipping?: ShippingPricing | null;
  now?: Date;
}

// ---------------------------------------------------------------------------
// Conversión desde filas de la DB
// ---------------------------------------------------------------------------

export interface PromotionRow {
  id: string;
  name: string;
  type: string;
  value: number;
  /** Parámetros de las promos por cantidad (migración 0017; ausente antes). */
  config?: unknown;
  scope: string;
  category_ids: string[];
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  priority: number;
  badge_label: string | null;
  stackable: boolean;
}

/** Entero en [min, max] o null. */
function intIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Tipo + parámetros de una fila. Un tipo desconocido o una promo por cantidad
 * con parámetros inválidos queda `unsupported` (el motor la ignora: nunca se
 * interpreta como un % por error).
 */
function typeFromRow(row: PromotionRow): Pick<Promotion, "type" | "buy" | "pay" | "nth"> {
  if (row.type === "percent" || row.type === "fixed") return { type: row.type };
  const config = row.config && typeof row.config === "object" ? (row.config as Record<string, unknown>) : {};
  if (row.type === "bxgy") {
    const buy = intIn(config.buy, 2, 99);
    const pay = intIn(config.pay, 1, 98);
    if (buy !== null && pay !== null && pay < buy) return { type: "bxgy", buy, pay };
  }
  if (row.type === "nth_unit_percent") {
    const nth = intIn(config.nth, 2, 99);
    if (nth !== null) return { type: "nth_unit_percent", nth };
  }
  return { type: "unsupported" };
}

export function promotionFromRow(row: PromotionRow): Promotion {
  return {
    id: row.id,
    name: row.name,
    ...typeFromRow(row),
    value: Number(row.value),
    scope: toScope(row.scope),
    categoryIds: row.category_ids ?? [],
    productIds: row.product_ids ?? [],
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    priority: row.priority,
    badgeLabel: row.badge_label,
    stackable: row.stackable,
  };
}

export interface CouponRow {
  code: string;
  type: string;
  value: number;
  min_subtotal: number | null;
  scope: string;
  category_ids: string[];
  product_ids: string[];
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
}

export function couponFromRow(row: CouponRow): Coupon {
  return {
    code: row.code,
    type: row.type === "fixed" ? "fixed" : row.type === "free_shipping" ? "free_shipping" : "percent",
    value: Number(row.value),
    minSubtotal: row.min_subtotal === null ? null : Number(row.min_subtotal),
    scope: toScope(row.scope),
    categoryIds: row.category_ids ?? [],
    productIds: row.product_ids ?? [],
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    isActive: row.is_active ?? true,
  };
}

function toScope(value: string): Scope {
  return value === "categories" || value === "products" ? value : "all";
}
