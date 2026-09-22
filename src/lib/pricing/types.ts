/**
 * Tipos del motor de precios. Son independientes de la DB (camelCase) para
 * que el motor sea puro y testeable; `fromRow` convierte filas de Supabase.
 */

export type Scope = "all" | "categories" | "products";

export interface Promotion {
  id: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
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

export interface CartLine {
  variantId: string;
  productId: string;
  qty: number;
  listPrice: number;
  unitPrice: number;
  promotion: AppliedPromotion | null;
  /** listPrice * qty */
  lineList: number;
  /** unitPrice * qty */
  lineTotal: number;
  /** (listPrice - unitPrice) * qty */
  promoDiscount: number;
}

export type CouponStatus =
  | { applied: true; code: string; discount: number; freeShipping: boolean; eligibleSubtotal: number }
  | { applied: false; code: string; reason: string };

export interface CartTotals {
  lines: CartLine[];
  /** Σ listPrice × qty */
  subtotal: number;
  /** Σ (listPrice − unitPrice) × qty */
  promoTotal: number;
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

export function promotionFromRow(row: PromotionRow): Promotion {
  return {
    id: row.id,
    name: row.name,
    type: row.type === "fixed" ? "fixed" : "percent",
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
