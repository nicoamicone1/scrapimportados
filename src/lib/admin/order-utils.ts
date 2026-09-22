/**
 * Lógica PURA de pedidos (sin DB ni React): estados, transiciones, saldos,
 * vencimiento de reserva, totales del pedido manual y movimientos de stock.
 * Testeada en `orders-logic.test.ts`.
 */

import { roundMoney } from "@/lib/money";

export const ORDER_STATUSES = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "partial", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENTS = ["delivery", "pickup"] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Sin pagar",
  partial: "Pago parcial",
  paid: "Pagado",
  refunded: "Reintegrado",
};

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  delivery: "Envío",
  pickup: "Retiro",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Etiqueta del estado, contemplando el retiro ("Listo para retirar" / "Retirado"). */
export function orderStatusLabel(status: string, fulfillment?: string | null): string {
  if (fulfillment === "pickup") {
    if (status === "shipped") return "Listo para retirar";
    if (status === "delivered") return "Retirado";
  }
  return isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status;
}

/**
 * ¿Se puede pasar de `from` a `to`? El panel es flexible para corregir
 * errores (se puede volver atrás), con dos reglas: un cancelado sólo se
 * reabre (vuelve a `pending`) y no se "cambia" al mismo estado.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === "cancelled") return to === "pending";
  return true;
}

/** Siguiente paso natural del flujo (acción principal del detalle). */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "pending":
      return "confirmed";
    case "confirmed":
      return "preparing";
    case "preparing":
      return "shipped";
    case "shipped":
      return "delivered";
    default:
      return null;
  }
}

/** Verbo del botón que lleva a `to`. */
export function statusActionLabel(to: OrderStatus, fulfillment: string | null | undefined, from?: OrderStatus): string {
  const pickup = fulfillment === "pickup";
  switch (to) {
    case "pending":
      return from === "cancelled" ? "Reabrir pedido" : "Volver a pendiente";
    case "confirmed":
      return "Confirmar";
    case "preparing":
      return "Pasar a preparación";
    case "shipped":
      return pickup ? "Listo para retirar" : "Marcar enviado";
    case "delivered":
      return pickup ? "Marcar retirado" : "Marcar entregado";
    case "cancelled":
      return "Cancelar pedido";
  }
}

export interface TrackingInfo {
  carrier?: string | null;
  number?: string | null;
  url?: string | null;
}

/** Mensaje del evento visible para el cliente al cambiar de estado. */
export function customerStatusMessage(
  to: OrderStatus,
  fulfillment: string | null | undefined,
  tracking?: TrackingInfo,
): string {
  const pickup = fulfillment === "pickup";
  switch (to) {
    case "pending":
      return "Reabrimos tu pedido.";
    case "confirmed":
      return "Confirmamos tu pedido.";
    case "preparing":
      return "Estamos preparando tu pedido.";
    case "shipped": {
      if (pickup) return "Tu pedido está listo para retirar.";
      const parts = ["Despachamos tu pedido."];
      if (tracking?.carrier) parts.push(`Lo lleva ${tracking.carrier}.`);
      if (tracking?.number) parts.push(`Número de seguimiento: ${tracking.number}.`);
      return parts.join(" ");
    }
    case "delivered":
      return pickup ? "Retiraste tu pedido. Gracias por tu compra." : "Entregamos tu pedido. Gracias por tu compra.";
    case "cancelled":
      return "El pedido fue cancelado.";
  }
}

/** Motivos de cancelación predefinidos (se guarda el texto en `cancel_reason`). */
export const CANCEL_REASONS = [
  "Lo pidió el cliente",
  "No se recibió el pago",
  "Sin stock",
  "Pedido duplicado",
  "Datos incorrectos",
] as const;

/** Texto legible de `cancel_reason` (incluye los códigos de sistema). */
export function cancelReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason === "expired") return "Venció sin registrar el pago";
  if (reason === "arrepentimiento") return "Arrepentimiento del cliente";
  return reason;
}

// ---------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------

export function amountPaid(payments: readonly { amount: number | string }[]): number {
  return roundMoney(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
}

/** Saldo pendiente (nunca negativo). */
export function balanceDue(total: number, paid: number): number {
  return Math.max(0, roundMoney(total - paid));
}

export interface OrderTotalsLike {
  subtotal: number;
  promo_total: number;
  coupon_discount: number;
  payment_discount: number;
  discount_total: number;
  shipping_cost: number;
  total: number;
}

/** Descuento manual (pedidos cargados a mano): lo que queda de `discount_total`. */
export function otherDiscount(o: OrderTotalsLike): number {
  return Math.max(0, roundMoney(o.discount_total - o.promo_total - o.coupon_discount - o.payment_discount));
}

// ---------------------------------------------------------------------
// Vencimiento de la reserva (P0-06)
// ---------------------------------------------------------------------

export interface ExpiryInfo {
  expired: boolean;
  /** Minutos restantes (negativo si ya venció). */
  minutesLeft: number;
  /** "Vence en 5 h", "Vence en 40 min", "Vence en 3 d", "Vencido". */
  label: string;
  /** Menos de 6 horas: se muestra como alerta. */
  soon: boolean;
}

export function hasReservation(o: { status: string; payment_status: string; expires_at: string | null }): boolean {
  return o.status === "pending" && o.payment_status === "pending" && Boolean(o.expires_at);
}

export function expiryInfo(expiresAt: string | Date | null | undefined, now: Date = new Date()): ExpiryInfo | null {
  if (!expiresAt) return null;
  const t = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  const minutesLeft = Math.floor((t - now.getTime()) / 60000);
  if (minutesLeft <= 0) return { expired: true, minutesLeft, label: "Vencido", soon: true };
  let label: string;
  if (minutesLeft < 60) label = `Vence en ${minutesLeft} min`;
  else if (minutesLeft < 48 * 60) label = `Vence en ${Math.floor(minutesLeft / 60)} h`;
  else label = `Vence en ${Math.floor(minutesLeft / 1440)} d`;
  return { expired: false, minutesLeft, label, soon: minutesLeft < 6 * 60 };
}

/** Nueva fecha al extender: desde el vencimiento actual (o ahora, si ya pasó). */
export function extendedExpiry(expiresAt: string | null, hours: number, now: Date = new Date()): Date {
  const current = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const base = Number.isNaN(current) ? now.getTime() : Math.max(current, now.getTime());
  return new Date(base + hours * 3600_000);
}

// ---------------------------------------------------------------------
// Pedido manual
// ---------------------------------------------------------------------

export interface ManualLine {
  /** Precio de lista de la variante. */
  listPrice: number;
  /** Precio unitario cobrado (editable). */
  unitPrice: number;
  qty: number;
}

export interface ManualTotalsInput {
  lines: readonly ManualLine[];
  shippingCost: number;
  manualDiscount: number;
  /** % de descuento del método de pago (0 si no se aplica). */
  paymentDiscountPercent: number;
}

export interface ManualTotals {
  subtotal: number;
  promoTotal: number;
  manualDiscount: number;
  paymentDiscount: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
}

/**
 * Totales de un pedido manual, con el mismo modelo que `create_order`:
 * subtotal a precio de lista, "promo" = rebaja del precio unitario, luego el
 * descuento manual y el del método de pago sobre lo que queda, más envío.
 * Si el precio cobrado supera el de lista, ese precio pasa a ser el de lista.
 */
export function computeManualTotals(input: ManualTotalsInput): ManualTotals {
  let subtotal = 0;
  let promoTotal = 0;
  for (const l of input.lines) {
    const qty = Math.max(0, Math.floor(l.qty));
    const unit = Math.max(0, l.unitPrice);
    const list = Math.max(unit, l.listPrice);
    subtotal += list * qty;
    promoTotal += (list - unit) * qty;
  }
  subtotal = roundMoney(subtotal);
  promoTotal = roundMoney(promoTotal);
  const base = roundMoney(subtotal - promoTotal);
  const manualDiscount = roundMoney(Math.min(Math.max(0, input.manualDiscount || 0), base));
  const pct = Math.min(100, Math.max(0, input.paymentDiscountPercent || 0));
  const paymentDiscount = roundMoney(((base - manualDiscount) * pct) / 100);
  const shippingCost = roundMoney(Math.max(0, input.shippingCost || 0));
  const discountTotal = roundMoney(promoTotal + manualDiscount + paymentDiscount);
  const total = roundMoney(subtotal - discountTotal + shippingCost);
  return { subtotal, promoTotal, manualDiscount, paymentDiscount, discountTotal, shippingCost, total };
}

// ---------------------------------------------------------------------
// Stock al cancelar / reabrir
// ---------------------------------------------------------------------

export interface OrderItemStockLike {
  variant_id: string | null;
  qty: number;
}

export interface MovementLike {
  variant_id: string;
  delta: number;
  reason: string;
}

/**
 * Unidades a DEVOLVER por variante al cancelar: el neto de movimientos del
 * pedido (ventas negativas menos devoluciones). Sólo si se descontó stock.
 */
export function stockToRestore(movements: readonly MovementLike[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const m of movements) net.set(m.variant_id, (net.get(m.variant_id) ?? 0) + m.delta);
  const out = new Map<string, number>();
  for (const [variant, n] of net) if (n < 0) out.set(variant, -n);
  return out;
}

/**
 * Unidades a VOLVER A DESCONTAR al reabrir: variantes que alguna vez
 * descontaron stock ('sale') y hoy tienen neto >= 0 (se devolvieron).
 */
export function stockToRededuct(
  items: readonly OrderItemStockLike[],
  movements: readonly MovementLike[],
): Map<string, number> {
  const sold = new Set(movements.filter((m) => m.reason === "sale").map((m) => m.variant_id));
  const net = new Map<string, number>();
  for (const m of movements) net.set(m.variant_id, (net.get(m.variant_id) ?? 0) + m.delta);
  const qty = new Map<string, number>();
  for (const it of items) {
    if (!it.variant_id) continue;
    qty.set(it.variant_id, (qty.get(it.variant_id) ?? 0) + it.qty);
  }
  const out = new Map<string, number>();
  for (const [variant, q] of qty) {
    if (sold.has(variant) && (net.get(variant) ?? 0) >= 0) out.set(variant, q);
  }
  return out;
}

// ---------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------

/** Limpia un texto para usarlo dentro de un filtro `or()` de PostgREST. */
export function sanitizeSearch(q: string | null | undefined): string {
  return (q ?? "").replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** "#1043" o "1043" → 1043 (búsqueda por número de pedido). */
export function parseOrderNumber(q: string): number | null {
  const m = /^#?\s*(\d{1,12})$/.exec(q.trim());
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------
// Snapshots jsonb del pedido
// ---------------------------------------------------------------------

type JsonLike = string | number | boolean | null | { [key: string]: JsonLike | undefined } | JsonLike[];

function obj(value: JsonLike | undefined): { [key: string]: JsonLike | undefined } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value: JsonLike | undefined): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export interface CustomerSnapshot {
  name: string;
  email: string | null;
  phone: string | null;
  doc: string | null;
}

export function parseCustomerSnapshot(value: JsonLike | undefined): CustomerSnapshot {
  const o = obj(value);
  return {
    name: str(o.name) || "Sin nombre",
    email: str(o.email) || null,
    phone: str(o.phone) || null,
    doc: str(o.doc) || null,
  };
}

export interface AddressSnapshot {
  street: string;
  number: string;
  floor: string;
  city: string;
  province: string;
  postal_code: string;
  notes: string;
}

export function parseAddress(value: JsonLike | undefined): AddressSnapshot | null {
  const o = obj(value);
  const a: AddressSnapshot = {
    street: str(o.street),
    number: str(o.number),
    floor: str(o.floor),
    city: str(o.city),
    province: str(o.province),
    postal_code: str(o.postal_code),
    notes: str(o.notes),
  };
  return a.street || a.city || a.province ? a : null;
}

/** ["Av. Siempre Viva 742, 3° B", "Springfield (1234), Buenos Aires"] */
export function addressLines(a: AddressSnapshot | null): string[] {
  if (!a) return [];
  const line1 = [[a.street, a.number].filter(Boolean).join(" "), a.floor].filter(Boolean).join(", ");
  const city = [a.city, a.postal_code ? `(${a.postal_code})` : ""].filter(Boolean).join(" ");
  const line2 = [city, a.province].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean);
}
