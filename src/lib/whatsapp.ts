import { WHATSAPP_PHONE } from "./config";
import { formatARS } from "./format";
import { PAYMENT_LABEL, type CartItem, type PaymentMethod } from "./cart";

export interface CheckoutData {
  items: CartItem[];
  payment: PaymentMethod;
  total: number;
  unitPrice: (item: CartItem) => number;
  /** Opcionales: se agregan al mensaje sólo si tienen texto. */
  name?: string;
  notes?: string;
}

/** Arma el texto plano del pedido que se manda por WhatsApp. */
export function buildOrderMessage({
  items,
  payment,
  total,
  unitPrice,
  name,
  notes,
}: CheckoutData): string {
  const lines: string[] = ["Hola! Quiero hacer este pedido:"];

  for (const item of items) {
    const unit = unitPrice(item);
    lines.push(
      `• ${item.qty}x ${item.name} (SKU ${item.sku}) — ${formatARS(unit)} c/u = ${formatARS(unit * item.qty)}`,
    );
  }

  lines.push(`Forma de pago: ${PAYMENT_LABEL[payment]}`);
  lines.push(`Total: ${formatARS(total)}`);

  const cleanName = (name ?? "").trim();
  const cleanNotes = (notes ?? "").trim();
  if (cleanName) lines.push(`Nombre: ${cleanName}`);
  if (cleanNotes) lines.push(`Notas: ${cleanNotes}`);

  return lines.join("\n");
}

/** URL de wa.me lista para abrir en una pestaña nueva. */
export function buildWhatsAppUrl(data: CheckoutData): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(buildOrderMessage(data))}`;
}
