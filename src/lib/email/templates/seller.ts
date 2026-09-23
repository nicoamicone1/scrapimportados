import { formatDateTime } from "@/lib/dates";

import { renderEmail, type EmailContent, type Inline } from "../layout";
import { clipText, formatDeadline, itemsBlock, moneyOf, plainPersonName, platformBrand, totalsBlock } from "./shared";
import type { OrderEmailData } from "./types";

/*
 * Avisos al VENDEDOR. Los manda Ecommy (no la tienda) al email de contacto
 * de la tienda (`store_settings.contact_email`). El reply-to es el cliente,
 * así el vendedor le contesta directo.
 *
 * Todo lo que escribe el comprador (nombre, nota, motivo) lo tipea cualquiera
 * en un formulario público, y el mail sale firmado por Ecommy: el asunto y el
 * preheader sólo llevan el nombre si parece un nombre (`plainPersonName`), y
 * el texto libre va rotulado como escrito por el comprador y recortado.
 */

/** Largo máximo del texto libre del comprador en el mail (el completo está en el panel). */
export const BUYER_TEXT_MAX = 300;

export interface SellerStoreInfo {
  name: string;
  /** Email de contacto al que llega el aviso (para el pie). */
  contactEmail: string;
  /** Origen de la plataforma (`https://www.ecommy.app`). */
  platformUrl: string;
}

function sellerFooter(store: SellerStoreInfo): (Inline | Inline[])[] {
  return [
    `Recibís este aviso porque ${store.contactEmail} es el email de contacto de ${store.name} en Ecommy.`,
    ["Lo cambiás en ", { href: `${store.platformUrl}/admin/configuracion/tienda`, label: "Configuración → Tienda" }, "."],
  ];
}

// ---------------------------------------------------------------------------
// Nuevo pedido
// ---------------------------------------------------------------------------

export function newOrderSellerEmail(order: OrderEmailData, store: SellerStoreInfo): EmailContent {
  const money = moneyOf(order);
  const adminUrl = `${store.platformUrl}/admin/pedidos/${order.id}`;
  const who = plainPersonName(order.customer.name);
  const subject = `Nuevo pedido #${order.number} · ${money(order.total)}${who ? ` · ${who}` : ""}`;
  const payment = order.payment?.name ?? "Sin método";
  const deadline = order.expiresAt ? formatDeadline(order.expiresAt, order.timezone) : "";

  return renderEmail({
    subject,
    preheader: `${who ?? "Pedido nuevo"} · Pago: ${payment} · ${order.deliveryText}.`,
    brand: platformBrand(store.platformUrl),
    blocks: [
      { t: "heading", text: `Nuevo pedido #${order.number}` },
      who
        ? { t: "p", content: [{ b: who }, ` hizo un pedido en ${store.name} por `, { b: money(order.total) }, "."] }
        : { t: "p", content: [`Entró un pedido en ${store.name} por `, { b: money(order.total) }, "."] },
      {
        t: "rows",
        rows: [
          { label: "Cliente", value: order.customer.name },
          { label: "Email", value: order.customer.email },
          { label: "Teléfono", value: order.customer.phone },
          { label: "Pago", value: payment },
          { label: "Entrega", value: order.deliveryText },
          { label: "Fecha", value: formatDateTime(order.createdAt, order.timezone) },
        ],
      },
      order.notes && { t: "p", content: ["Nota escrita por el comprador: ", clipText(order.notes, BUYER_TEXT_MAX)], muted: true },
      deadline && {
        t: "p",
        content: `La reserva de stock vence el ${deadline}. Cuando llegue el pago, registralo desde el pedido.`,
        muted: true,
      },
      { t: "button", href: adminUrl, label: "Abrir el pedido en el panel" },
      { t: "section", title: "Detalle" },
      itemsBlock(order),
      totalsBlock(order),
    ],
    footer: sellerFooter(store),
  });
}

// ---------------------------------------------------------------------------
// Nueva solicitud de arrepentimiento
// ---------------------------------------------------------------------------

export interface WithdrawalEmailData {
  code: string;
  name: string;
  contact: string;
  orderNumber: string | null;
  orderFound: boolean;
  reason: string | null;
  createdAt: string;
  timezone: string;
}

export function withdrawalSellerEmail(w: WithdrawalEmailData, store: SellerStoreInfo): EmailContent {
  const subject = `Solicitud de arrepentimiento ${w.code} · ${store.name}`;
  const orderLabel = w.orderNumber ? `#${w.orderNumber}${w.orderFound ? "" : " (no coincide con un pedido de la tienda)"}` : "No lo indicó";
  return renderEmail({
    subject,
    preheader: `${plainPersonName(w.name) ?? "Alguien"} pidió revocar una compra${w.orderNumber ? ` (pedido #${w.orderNumber})` : ""}.`,
    brand: platformBrand(store.platformUrl),
    blocks: [
      { t: "heading", text: "Nueva solicitud de arrepentimiento" },
      { t: "p", content: `Alguien usó el botón de arrepentimiento de ${store.name} para revocar una compra.` },
      {
        t: "rows",
        rows: [
          { label: "Código", value: w.code, mono: true },
          { label: "Nombre", value: w.name },
          { label: "Contacto", value: w.contact },
          { label: "Pedido", value: orderLabel },
          { label: "Fecha", value: formatDateTime(w.createdAt, w.timezone) },
        ],
      },
      w.reason && { t: "p", content: ["Motivo escrito por quien pidió: ", clipText(w.reason, BUYER_TEXT_MAX)], muted: true },
      { t: "p", content: "Contactá al cliente y marcá la solicitud como procesada o rechazada desde el panel." },
      { t: "button", href: `${store.platformUrl}/admin/pedidos/arrepentimientos`, label: "Ver las solicitudes" },
    ],
    footer: sellerFooter(store),
  });
}
