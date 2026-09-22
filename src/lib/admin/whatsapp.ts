/**
 * Mensajes de WhatsApp prearmados desde el admin (lógica pura, testeada).
 * El vendedor abre `wa.me` con el texto listo; nada se envía solo.
 */

/**
 * Teléfono → número para `wa.me` (sólo dígitos, con código de país).
 * Heurística para Argentina: "11 5555-1234" → "5491155551234",
 * "011 15 5555 1234" → "5491155551234", "+54 9 11…" se respeta.
 * Números con otro código de país (más de 10 dígitos) se dejan como están.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    let rest = d.slice(2);
    if (rest.startsWith("9")) rest = rest.slice(1);
    if (rest.startsWith("0")) rest = rest.slice(1);
    rest = stripLocal15(rest);
    return rest.length >= 8 ? `549${rest}` : null;
  }
  if (d.startsWith("0")) d = d.slice(1);
  d = stripLocal15(d);
  if (d.length === 10) return `549${d}`;
  if (d.length > 10) return d;
  return null;
}

/** "11 15 5555 1234" (12 dígitos con el 15 del celular) → "1155551234". */
function stripLocal15(d: string): string {
  if (d.length !== 12) return d;
  // Códigos de área de 2, 3 o 4 dígitos seguidos de "15".
  for (const len of [2, 3, 4]) {
    if (d.slice(len, len + 2) === "15") return d.slice(0, len) + d.slice(len + 2);
  }
  return d;
}

export function waLink(phone: string | null | undefined, text: string): string | null {
  const n = toWhatsAppNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export type WhatsAppTemplateKind =
  | "payment_pending"
  | "confirmed"
  | "shipped"
  | "pickup_ready"
  | "delivered"
  | "cancelled"
  | "generic";

export const WHATSAPP_TEMPLATE_LABELS: Record<WhatsAppTemplateKind, string> = {
  payment_pending: "Recordatorio de pago",
  confirmed: "Pedido confirmado",
  shipped: "Pedido despachado",
  pickup_ready: "Listo para retirar",
  delivered: "Gracias por tu compra",
  cancelled: "Pedido cancelado",
  generic: "Mensaje general",
};

/** Plantilla que corresponde al estado actual del pedido. */
export function whatsAppTemplateFor(o: {
  status: string;
  payment_status: string;
  fulfillment: string | null;
}): WhatsAppTemplateKind {
  if (o.status === "cancelled") return "cancelled";
  const unpaid = o.payment_status === "pending" || o.payment_status === "partial";
  if (unpaid && (o.status === "pending" || o.status === "confirmed")) return "payment_pending";
  if (o.status === "shipped") return o.fulfillment === "pickup" ? "pickup_ready" : "shipped";
  if (o.status === "delivered") return "delivered";
  if (o.status === "confirmed" || o.status === "preparing") return "confirmed";
  return "generic";
}

export interface WhatsAppMessageContext {
  storeName: string;
  customerName?: string | null;
  number: number;
  /** Total formateado ("$ 41.262"). */
  total: string;
  /** Saldo formateado, si es distinto del total (pago parcial). */
  balance?: string | null;
  /** Link público `/pedido/[token]`. */
  orderUrl?: string | null;
  tracking?: { carrier?: string | null; number?: string | null; url?: string | null } | null;
  pickup?: { name?: string | null; address?: string | null; hours?: string | null } | null;
  transfer?: { alias?: string | null; cbu?: string | null } | null;
  /** Método de pago elegido ('transfer' muestra los datos bancarios). */
  paymentMethodCode?: string | null;
  /** "jueves 18:00", para el recordatorio de pago. */
  expiresLabel?: string | null;
}

function firstName(name: string | null | undefined): string {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return n ? ` ${n}` : "";
}

/** Arma el texto (sin emojis, en voseo) para la plantilla elegida. */
export function buildWhatsAppMessage(kind: WhatsAppTemplateKind, ctx: WhatsAppMessageContext): string {
  const hi = `Hola${firstName(ctx.customerName)}, te escribimos de ${ctx.storeName}.`;
  const ref = `#${ctx.number}`;
  const link = ctx.orderUrl ? `Podés ver el pedido acá: ${ctx.orderUrl}` : null;
  const lines: (string | null | false | undefined)[] = [];

  switch (kind) {
    case "payment_pending": {
      const amount = ctx.balance ?? ctx.total;
      lines.push(hi, `Tu pedido ${ref} está pendiente de pago. El monto a abonar es ${amount}.`);
      const t = ctx.transfer;
      if (ctx.paymentMethodCode === "transfer" && (t?.alias || t?.cbu)) {
        lines.push("", "Datos para transferir:");
        if (t?.alias) lines.push(`Alias: ${t.alias}`);
        if (t?.cbu) lines.push(`CBU: ${t.cbu}`);
        lines.push(`Poné ${ref} en el concepto y mandanos el comprobante por acá.`);
      } else {
        lines.push("Avisanos cómo preferís pagar y lo coordinamos.");
      }
      if (ctx.expiresLabel) lines.push(`Te reservamos el stock hasta el ${ctx.expiresLabel}.`);
      break;
    }
    case "confirmed":
      lines.push(hi, `Confirmamos tu pedido ${ref} y ya lo estamos preparando. Te avisamos cuando esté en camino.`);
      break;
    case "shipped": {
      const tr = ctx.tracking;
      lines.push(hi, `Tu pedido ${ref} ya está en camino${tr?.carrier ? ` con ${tr.carrier}` : ""}.`);
      if (tr?.number) lines.push(`Número de seguimiento: ${tr.number}`);
      if (tr?.url) lines.push(`Seguilo acá: ${tr.url}`);
      break;
    }
    case "pickup_ready": {
      const p = ctx.pickup;
      lines.push(hi, `Tu pedido ${ref} está listo para retirar${p?.name ? ` en ${p.name}` : ""}.`);
      if (p?.address) lines.push(`Dirección: ${p.address}`);
      if (p?.hours) lines.push(`Horarios: ${p.hours}`);
      lines.push("Cuando vengas, decinos el número de pedido.");
      break;
    }
    case "delivered":
      lines.push(hi, `Gracias por tu compra. Si tenés cualquier consulta sobre el pedido ${ref}, escribinos por acá.`);
      break;
    case "cancelled":
      lines.push(hi, `Te contamos que el pedido ${ref} quedó cancelado. Si fue un error o querés rehacerlo, respondé este mensaje.`);
      break;
    case "generic":
      lines.push(hi, `Te escribimos por tu pedido ${ref}.`);
      break;
  }

  if (link && kind !== "delivered") lines.push("", link);
  return lines.filter((l): l is string => typeof l === "string").join("\n");
}
