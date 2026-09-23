export type { Brand, EmailContent } from "../layout";

/** Tienda que firma un mail al comprador (o a la que se refiere un aviso). */
export interface StoreEmailInfo {
  name: string;
  /** Home pública absoluta de la tienda. */
  url: string;
  logoUrl?: string | null;
  /** `theme.colors.primary` / `primaryText` de la tienda (hex). */
  primary?: string | null;
  primaryText?: string | null;
  /** Email de contacto (reply-to de los mails al comprador y destino de los avisos). */
  contactEmail?: string | null;
  /** Link `wa.me` ya armado (o null). */
  whatsappUrl?: string | null;
}

export interface OrderEmailItem {
  name: string;
  variantTitle: string | null;
  qty: number;
  unitPrice: number;
  total: number;
}

/** Vista de un pedido para los emails (sale de `get_order_by_token`). */
export interface OrderEmailData {
  id: string;
  number: number;
  createdAt: string;
  currency: string;
  locale: string;
  timezone: string;
  status: "pending" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: "pending" | "paid" | "partial" | "refunded";
  customer: { name: string; email: string; phone: string };
  items: OrderEmailItem[];
  subtotal: number;
  /** Todas las promos (por unidad + por cantidad). */
  promoTotal: number;
  /** Parte de `promoTotal` de promos por cantidad (3x2), a nivel pedido. Sin 0018: 0 / ausente. */
  bundleDiscount?: number;
  couponCode: string | null;
  couponDiscount: number;
  paymentDiscount: number;
  paymentDiscountPercent: number;
  shippingCost: number;
  shippingZoneName: string | null;
  total: number;
  fulfillment: "delivery" | "pickup";
  /** "Envío a Av. Santa Fe 3253, CABA" / "Retiro en Local Palermo". */
  deliveryText: string;
  pickup: { name: string; address: string; hoursText: string } | null;
  payment: { name: string; type: string; instructions: string } | null;
  /** Datos de transferencia de la tienda (sólo si el método es transferencia). */
  transfer: { bankName: string; holder: string; cbu: string; alias: string; cuit: string; instructions: string } | null;
  expiresAt: string | null;
  /** Nota que dejó el comprador en el checkout. */
  notes: string | null;
  tracking: { carrier: string; number: string; url: string } | null;
  /** `cancel_reason` crudo: la plantilla decide qué se puede mostrar. */
  cancelReason: string | null;
  /** `/pedido/<token>` absoluto en la tienda. */
  statusUrl: string;
}
