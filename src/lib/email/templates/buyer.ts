import { renderEmail, type Block, type EmailContent } from "../layout";
import {
  buyerFooter,
  deliveryBlocks,
  formatDeadline,
  greeting,
  itemsBlock,
  moneyOf,
  storeBrand,
  totalsBlock,
} from "./shared";
import type { OrderEmailData, StoreEmailInfo } from "./types";

/*
 * Mails al COMPRADOR. Los firma la tienda ("{Tienda} vía Ecommy") y el
 * reply-to es el email de contacto de la tienda. Nunca muestran notas
 * internas ni el motivo de cancelación escrito a mano por el vendedor.
 */

function paragraphs(text: string, muted = false): Block[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((content) => ({ t: "p", content, muted }) as Block);
}

/** Transferencia: por el tipo del método o, si el método ya no existe, porque vinieron los datos bancarios. */
function isTransfer(order: OrderEmailData): boolean {
  return order.payment?.type === "transfer" || Boolean(order.transfer);
}

function isWhatsapp(order: OrderEmailData): boolean {
  return order.payment?.type === "whatsapp";
}

/** Bloque "cómo pagar" según el método (transferencia, WhatsApp u otro). */
function paymentBlocks(order: OrderEmailData, store: StoreEmailInfo): Block[] {
  const money = moneyOf(order);
  if (order.paymentStatus === "paid") return [];

  if (isTransfer(order)) {
    const t = order.transfer;
    const hasBank = Boolean(t && (t.cbu || t.alias));
    const inner: Block[] = [
      { t: "section", title: `Transferí ${money(order.total)}` },
      { t: "p", content: ["Poné ", { b: `#${order.number}` }, " en el concepto o la referencia de la transferencia."] },
    ];
    if (hasBank && t) {
      inner.push({
        t: "rows",
        rows: [
          { label: "Monto", value: money(order.total), mono: true },
          { label: "Alias", value: t.alias, mono: true },
          { label: "CBU / CVU", value: t.cbu, mono: true },
          { label: "Titular", value: t.holder },
          { label: "CUIT", value: t.cuit, mono: true },
          { label: "Banco", value: t.bankName },
        ],
      });
    } else {
      inner.push({ t: "p", content: "Te pasamos los datos bancarios por WhatsApp o por mail. Escribinos con el número de pedido." });
    }
    const instructions = t?.instructions || order.payment?.instructions || "";
    if (instructions) inner.push(...paragraphs(instructions, true));
    const deadline = order.expiresAt ? formatDeadline(order.expiresAt, order.timezone) : "";
    if (deadline) {
      inner.push({
        t: "p",
        content: [
          "Te reservamos el stock hasta el ",
          { b: deadline },
          ". Si no registramos el pago para esa fecha, el pedido se cancela solo.",
        ],
      });
    }
    if (store.whatsappUrl) inner.push({ t: "button", href: store.whatsappUrl, label: "Enviar el comprobante por WhatsApp" });
    return [{ t: "box", blocks: inner }];
  }

  if (isWhatsapp(order)) {
    const inner: Block[] = [
      { t: "section", title: "Coordiná el pago y la entrega por WhatsApp" },
      { t: "p", content: `Escribinos con el número de pedido #${order.number} y te pasamos cómo pagar.` },
    ];
    if (store.whatsappUrl) inner.push({ t: "button", href: store.whatsappUrl, label: "Abrir WhatsApp" });
    return [{ t: "box", blocks: inner }];
  }

  if (order.payment) {
    return [
      { t: "p", content: ["Elegiste pagar con ", { b: order.payment.name }, "."] },
      ...(order.payment.instructions ? paragraphs(order.payment.instructions, true) : []),
    ];
  }
  return [];
}

function nextSteps(order: OrderEmailData): Block {
  return {
    t: "list",
    ordered: true,
    items: [
      isTransfer(order) ? "Transferís y nos mandás el comprobante." : "Acordamos el pago.",
      "Confirmamos el pago y te avisamos por mail.",
      order.fulfillment === "pickup" ? "Preparamos el pedido y te avisamos cuando esté listo para retirar." : "Preparamos y despachamos tu pedido.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Recibimos tu pedido
// ---------------------------------------------------------------------------

export function orderReceivedEmail(order: OrderEmailData, store: StoreEmailInfo): EmailContent {
  const money = moneyOf(order);
  const subject = `Recibimos tu pedido #${order.number}`;
  const preheader = isTransfer(order)
    ? `Transferí ${money(order.total)} con el concepto #${order.number} para confirmarlo.`
    : isWhatsapp(order)
      ? `Coordinamos el pago por WhatsApp. Total: ${money(order.total)}.`
      : `Total: ${money(order.total)}. ${order.deliveryText}.`;

  return renderEmail({
    subject,
    preheader,
    brand: storeBrand(store),
    blocks: [
      { t: "heading", text: subject },
      { t: "p", content: `${greeting(order.customer.name)} Gracias por comprar en ${store.name}. Te dejamos el detalle y lo que falta para terminar.` },
      ...paymentBlocks(order, store),
      { t: "button", href: order.statusUrl, label: "Ver el estado del pedido" },
      order.paymentStatus !== "paid" && { t: "section", title: "Qué pasa ahora" },
      order.paymentStatus !== "paid" && nextSteps(order),
      { t: "section", title: "Detalle" },
      itemsBlock(order),
      totalsBlock(order),
      ...deliveryBlocks(order),
      order.notes && { t: "p", content: ["Tu nota: ", order.notes], muted: true },
    ],
    footer: buyerFooter(store),
  });
}

// ---------------------------------------------------------------------------
// Pago confirmado
// ---------------------------------------------------------------------------

export function orderPaidEmail(order: OrderEmailData, store: StoreEmailInfo): EmailContent {
  const money = moneyOf(order);
  const subject = `Confirmamos el pago de tu pedido #${order.number}`;
  const next =
    order.fulfillment === "pickup"
      ? "Ahora lo preparamos y te avisamos por mail cuando esté listo para retirar."
      : "Ahora lo preparamos y te avisamos por mail cuando lo despachemos.";
  return renderEmail({
    subject,
    preheader: `Registramos el pago de ${money(order.total)}. ${next}`,
    brand: storeBrand(store),
    blocks: [
      { t: "heading", text: "Pago confirmado" },
      { t: "p", content: [greeting(order.customer.name), " Registramos el pago de tu pedido ", { b: `#${order.number}` }, ` por ${money(order.total)}.`] },
      { t: "p", content: next },
      { t: "button", href: order.statusUrl, label: "Ver el pedido" },
      { t: "section", title: "Detalle" },
      itemsBlock(order),
      totalsBlock(order),
      ...deliveryBlocks(order),
    ],
    footer: buyerFooter(store),
  });
}

// ---------------------------------------------------------------------------
// Pedido enviado / listo para retirar
// ---------------------------------------------------------------------------

export interface ShippedOptions {
  /** `true`: sólo se actualizó el número de seguimiento (el pedido ya estaba enviado). */
  trackingUpdate?: boolean;
}

export function orderShippedEmail(order: OrderEmailData, store: StoreEmailInfo, options: ShippedOptions = {}): EmailContent {
  const pickup = order.fulfillment === "pickup";
  const tracking = order.tracking;
  const trackingHref = tracking?.url && /^https?:\/\//i.test(tracking.url) ? tracking.url : null;

  const subject = pickup
    ? `Tu pedido #${order.number} está listo para retirar`
    : options.trackingUpdate
      ? `Número de seguimiento de tu pedido #${order.number}`
      : `Despachamos tu pedido #${order.number}`;

  const lead = pickup
    ? `${greeting(order.customer.name)} Tu pedido #${order.number} ya está listo. Podés pasar a retirarlo.`
    : options.trackingUpdate
      ? `${greeting(order.customer.name)} Ya tenemos el número de seguimiento de tu pedido #${order.number}.`
      : `${greeting(order.customer.name)} Despachamos tu pedido #${order.number}${tracking?.carrier ? ` con ${tracking.carrier}` : ""}.`;

  const blocks: Block[] = [
    { t: "heading", text: pickup ? "Listo para retirar" : options.trackingUpdate ? "Seguimiento del envío" : "Pedido enviado" },
    { t: "p", content: lead },
  ];
  if (!pickup && tracking) {
    blocks.push({
      t: "rows",
      rows: [
        { label: "Transporte", value: tracking.carrier },
        { label: "Número de seguimiento", value: tracking.number, mono: true },
      ],
    });
  }
  if (pickup) {
    blocks.push(...deliveryBlocks(order));
    if (order.paymentStatus !== "paid") {
      blocks.push({ t: "p", content: `El saldo del pedido se paga al retirar. Total: ${moneyOf(order)(order.total)}.`, muted: true });
    }
    blocks.push({ t: "button", href: order.statusUrl, label: "Ver el pedido" });
  } else {
    blocks.push(
      trackingHref
        ? { t: "button", href: trackingHref, label: "Seguir el envío" }
        : { t: "button", href: order.statusUrl, label: "Ver el pedido" },
    );
    if (trackingHref) blocks.push({ t: "p", content: ["También podés ver el pedido en ", { href: order.statusUrl, label: "su página" }, "."], muted: true });
    blocks.push(...deliveryBlocks(order));
  }
  blocks.push({ t: "section", title: "Detalle" }, itemsBlock(order));

  return renderEmail({
    subject,
    preheader: pickup
      ? `Retiralo en ${order.pickup?.name || "el local"}.`
      : tracking?.number
        ? `Número de seguimiento: ${tracking.number}.`
        : "Te avisamos cuando llegue.",
    brand: storeBrand(store),
    blocks,
    footer: buyerFooter(store),
  });
}

// ---------------------------------------------------------------------------
// Pedido cancelado
// ---------------------------------------------------------------------------

/**
 * Motivo apto para el comprador. Sólo se muestran los motivos predefinidos
 * (`CANCEL_REASONS` y códigos de sistema); un texto libre del vendedor puede
 * tener datos internos, así que no sale.
 */
export function customerCancelReason(reason: string | null | undefined): string | null {
  switch ((reason ?? "").trim()) {
    case "expired":
    case "No se recibió el pago":
      return "porque venció el plazo para registrar el pago";
    case "Sin stock":
      return "porque nos quedamos sin stock de un producto";
    case "Pedido duplicado":
      return "porque estaba duplicado";
    case "Lo pidió el cliente":
    case "arrepentimiento":
      return "a tu pedido";
    default:
      return null;
  }
}

export function orderCancelledEmail(order: OrderEmailData, store: StoreEmailInfo): EmailContent {
  const reason = customerCancelReason(order.cancelReason);
  const subject = `Cancelamos tu pedido #${order.number}`;
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "partial";
  const contact = store.contactEmail
    ? "Si creés que es un error, respondé este mail."
    : store.whatsappUrl
      ? "Si creés que es un error, escribinos por WhatsApp."
      : null;
  return renderEmail({
    subject,
    preheader: reason ? `Cancelamos el pedido ${reason}.` : `El pedido #${order.number} quedó cancelado.`,
    brand: storeBrand(store),
    blocks: [
      { t: "heading", text: "Pedido cancelado" },
      { t: "p", content: `${greeting(order.customer.name)} Cancelamos tu pedido #${order.number}${reason ? ` ${reason}` : ""}.` },
      paid && { t: "p", content: "Si ya pagaste, escribinos para coordinar la devolución del dinero." },
      contact && { t: "p", content: contact },
      store.whatsappUrl && !store.contactEmail && { t: "button", href: store.whatsappUrl, label: "Escribir por WhatsApp" },
      { t: "section", title: "Detalle del pedido cancelado" },
      itemsBlock(order),
      totalsBlock(order),
      { t: "p", content: ["Si querés, podés volver a comprar en ", { href: store.url, label: store.name }, "."], muted: true },
    ],
    footer: buyerFooter(store),
  });
}
