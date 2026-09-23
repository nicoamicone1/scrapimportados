import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";

import { asArray, asBool, asNumber, asObject, asString } from "./utils";

/** Pedido público leído por token (`get_order_by_token`). SIN cache: el estado cambia. */
export interface PublicOrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  listPrice: number;
  qty: number;
  total: number;
}

export interface PublicOrderEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface PublicShippingAddress {
  street: string;
  number: string;
  floor: string;
  city: string;
  province: string;
  postal_code: string;
  notes: string;
}

export interface PublicOrder {
  id: string;
  number: number;
  token: string;
  createdAt: string;
  status: "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "partial" | "refunded";
  paymentMethodCode: string;
  paymentDiscountPercent: number;
  paymentDiscount: number;
  fulfillment: "delivery" | "pickup";
  shippingZoneName: string | null;
  shippingCost: number;
  shippingAddress: PublicShippingAddress | null;
  subtotal: number;
  /** Todas las promos (por unidad + por cantidad). */
  promoTotal: number;
  /**
   * Parte de `promoTotal` que es de promos por cantidad (3x2, 2.ª al 50 %),
   * a nivel pedido (migración 0018; 0 si todavía no se aplicó). Opcional
   * para los armados a mano (tests); `parsePublicOrder` siempre lo completa.
   */
  bundleDiscount?: number;
  couponCode: string | null;
  couponDiscount: number;
  discountTotal: number;
  total: number;
  currency: string;
  notes: string | null;
  customer: { name: string; email: string; phone: string; doc: string };
  expiresAt: string | null;
  cancelReason: string | null;
  tracking: { carrier: string; number: string; url: string } | null;
  items: PublicOrderItem[];
  events: PublicOrderEvent[];
  paymentMethod: { code: string; name: string; type: string; discountPercent: number; instructionsMd: string } | null;
  pickupLocation: { name: string; address: string; hoursText: string; instructionsMd: string } | null;
  transfer: { enabled: boolean; bankName: string; holder: string; cbu: string; alias: string; cuit: string; instructionsMd: string };
  whatsappTemplate: string;
  store: { id: string; slug: string; name: string; whatsappPhone: string; contactEmail: string; currency: string; locale: string; timezone: string };
}

function nullable(v: Json | undefined): string | null {
  const s = asString(v).trim();
  return s ? s : null;
}

const STATUSES = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;
const PAYMENT_STATUSES = ["pending", "paid", "partial", "refunded"] as const;

export function parsePublicOrder(raw: Json, token: string): PublicOrder | null {
  const root = asObject(raw);
  const o = asObject(root.order);
  if (!asString(o.id)) return null;
  const customer = asObject(o.customer);
  const addr = o.shipping_address && typeof o.shipping_address === "object" ? asObject(o.shipping_address) : null;
  const pm = root.payment_method ? asObject(root.payment_method) : null;
  const pickup = root.pickup_location ? asObject(root.pickup_location) : null;
  const checkout = asObject(root.checkout);
  const transfer = asObject(checkout.transfer);
  const store = asObject(root.store);
  const status = asString(o.status);
  const paymentStatus = asString(o.payment_status);
  const trackingNumber = asString(o.tracking_number);

  return {
    id: asString(o.id),
    number: asNumber(o.number),
    token,
    createdAt: asString(o.created_at),
    status: (STATUSES as readonly string[]).includes(status) ? (status as PublicOrder["status"]) : "pending",
    paymentStatus: (PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
      ? (paymentStatus as PublicOrder["paymentStatus"])
      : "pending",
    paymentMethodCode: asString(o.payment_method_code),
    paymentDiscountPercent: asNumber(o.payment_discount_percent),
    paymentDiscount: asNumber(o.payment_discount),
    fulfillment: asString(o.fulfillment) === "pickup" ? "pickup" : "delivery",
    shippingZoneName: nullable(o.shipping_zone_name),
    shippingCost: asNumber(o.shipping_cost),
    shippingAddress: addr
      ? {
          street: asString(addr.street),
          number: asString(addr.number),
          floor: asString(addr.floor),
          city: asString(addr.city),
          province: asString(addr.province),
          postal_code: asString(addr.postal_code),
          notes: asString(addr.notes),
        }
      : null,
    subtotal: asNumber(o.subtotal),
    promoTotal: asNumber(o.promo_total),
    bundleDiscount: asNumber(o.bundle_discount),
    couponCode: nullable(o.coupon_code),
    couponDiscount: asNumber(o.coupon_discount),
    discountTotal: asNumber(o.discount_total),
    total: asNumber(o.total),
    currency: asString(o.currency, "ARS") || "ARS",
    notes: nullable(o.notes),
    customer: {
      name: asString(customer.name),
      email: asString(customer.email),
      phone: asString(customer.phone),
      doc: asString(customer.doc),
    },
    expiresAt: nullable(o.expires_at),
    cancelReason: nullable(o.cancel_reason),
    tracking: trackingNumber
      ? { carrier: asString(o.tracking_carrier), number: trackingNumber, url: asString(o.tracking_url) }
      : null,
    items: asArray(root.items).map((raw) => {
      const i = asObject(raw);
      return {
        id: asString(i.id),
        productId: nullable(i.product_id),
        variantId: nullable(i.variant_id),
        name: asString(i.name),
        variantTitle: nullable(i.variant_title),
        sku: nullable(i.sku),
        imageUrl: nullable(i.image_url),
        unitPrice: asNumber(i.unit_price),
        listPrice: asNumber(i.list_price),
        qty: asNumber(i.qty),
        total: asNumber(i.total),
      };
    }),
    events: asArray(root.events).map((raw) => {
      const e = asObject(raw);
      return { id: asString(e.id), type: asString(e.type), message: asString(e.message), createdAt: asString(e.created_at) };
    }),
    paymentMethod: pm
      ? {
          code: asString(pm.code),
          name: asString(pm.name),
          type: asString(pm.type),
          discountPercent: asNumber(pm.discount_percent),
          instructionsMd: asString(pm.instructions_md),
        }
      : null,
    pickupLocation: pickup
      ? {
          name: asString(pickup.name),
          address: asString(pickup.address),
          hoursText: asString(pickup.hours_text),
          instructionsMd: asString(pickup.instructions_md),
        }
      : null,
    transfer: {
      enabled: asBool(transfer.enabled, true),
      bankName: asString(transfer.bank_name),
      holder: asString(transfer.holder),
      cbu: asString(transfer.cbu),
      alias: asString(transfer.alias),
      cuit: asString(transfer.cuit),
      instructionsMd: asString(transfer.instructions_md),
    },
    whatsappTemplate: asString(asObject(checkout.whatsapp).message_template),
    store: {
      id: asString(store.id),
      slug: asString(store.slug),
      name: asString(store.name),
      whatsappPhone: asString(store.whatsapp_phone),
      contactEmail: asString(store.contact_email),
      currency: asString(store.currency, "ARS") || "ARS",
      locale: asString(store.locale, "es-AR") || "es-AR",
      timezone: asString(store.timezone, "America/Argentina/Buenos_Aires") || "America/Argentina/Buenos_Aires",
    },
  };
}

/**
 * Pedido por token, SÓLO si es de `storeId` (el token es global: sin este
 * chequeo, `/s/otra-tienda/pedido/<token>` mostraría el pedido con la marca
 * de otra tienda).
 */
export async function getOrderByToken(storeId: string, token: string): Promise<PublicOrder | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_order_by_token", { p_token: token });
  if (error) {
    console.error(`[pedido] ${error.message}`);
    return null;
  }
  const order = data ? parsePublicOrder(data, token) : null;
  return order && order.store.id === storeId ? order : null;
}

/** "Envío a Av. Santa Fe 3253 2B, Palermo, CABA" / "Retiro en Local Palermo". */
export function deliveryText(order: Pick<PublicOrder, "fulfillment" | "shippingAddress" | "pickupLocation" | "shippingZoneName">): string {
  if (order.fulfillment === "pickup") {
    return order.pickupLocation ? `Retiro en ${order.pickupLocation.name}` : "Retiro en el local";
  }
  const a = order.shippingAddress;
  if (!a) return "Envío a domicilio";
  const street = [a.street, a.number, a.floor].filter(Boolean).join(" ");
  return `Envío a ${[street, a.city, a.province].filter(Boolean).join(", ")}`;
}
