import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

import { brandColors, PLATFORM_ACCENT, PLATFORM_ACCENT_TEXT, type Block, type Brand, type Inline } from "../layout";
import type { OrderEmailData, StoreEmailInfo } from "./types";

/** Marca de un mail firmado por una tienda (acento = primary del tema, si es válido). */
export function storeBrand(store: StoreEmailInfo): Brand {
  return { name: store.name, url: store.url, logoUrl: store.logoUrl ?? null, ...brandColors(store.primary, store.primaryText) };
}

/** Marca de los mails de la plataforma (verde-tinta de Ecommy, sin logo remoto). */
export function platformBrand(url: string | null): Brand {
  return { name: "Ecommy", url, logoUrl: null, accent: PLATFORM_ACCENT, accentText: PLATFORM_ACCENT_TEXT };
}

export function moneyOf(order: Pick<OrderEmailData, "currency" | "locale">): (value: number) => string {
  return (value) => formatMoney(value, { currency: order.currency, locale: order.locale });
}

/** "Lucía" de "Lucía Fernández" (o "" si no hay nombre). */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Un nombre de pila "de verdad": sólo letras, apóstrofo y guion, hasta 30.
 * El checkout es público y el nombre lo tipea cualquiera: con esto el saludo
 * no puede llevar links, dominios ni frases ("Hola, verificá-tu-cuenta.com.").
 */
const PLAIN_FIRST_NAME = /^[\p{L}'’-]{1,30}$/u;

/** "Hola, Lucía." o "Hola." si el primer nombre no parece un nombre. */
export function greeting(name: string | null | undefined): string {
  const first = firstName(name).normalize("NFC");
  return PLAIN_FIRST_NAME.test(first) ? `Hola, ${first}.` : "Hola.";
}

/**
 * Nombre del cliente para asuntos y preheaders de mails de la PLATAFORMA
 * (el vendedor los recibe firmados por Ecommy): sólo si son letras, espacios,
 * apóstrofos y guiones, recortado a 40 caracteres. Si no (links, dominios,
 * símbolos), `null` y el mail usa un texto neutro.
 */
export function plainPersonName(name: string | null | undefined, max = 40): string | null {
  const clean = (name ?? "").replace(/\s+/g, " ").trim();
  if (!clean || !/^[\p{L}\p{M}'’ -]+$/u.test(clean)) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Texto libre de un tercero para un mail: sin saltos repetidos y recortado a `max`. */
export function clipText(text: string | null | undefined, max = 300): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Zona horaria IANA válida (una inválida hace tirar a `Intl` y el mail no saldría). */
export function validTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("es-AR", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** "jueves 24/09 a las 18:00 h" en la zona horaria de la tienda. */
export function formatDeadline(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  timeZone = validTimeZone(timeZone);
  const day = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone }).format(d);
  return `${day} ${formatDateTime(iso, timeZone).replace(/\/\d{4}/, "").replace(" ", " a las ")} h`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Ítems del pedido como líneas de recibo. */
export function itemsBlock(order: OrderEmailData): Block {
  const money = moneyOf(order);
  return {
    t: "items",
    items: order.items.map((i) => ({
      name: i.name,
      detail: [i.variantTitle, `${i.qty} × ${money(i.unitPrice)}`].filter(Boolean).join(" · "),
      amount: money(i.total),
    })),
  };
}

/** Subtotal, descuentos, envío y total (mismo criterio que /pedido/[token]). */
export function totalsBlock(order: OrderEmailData): Block {
  const money = moneyOf(order);
  const rows: { label: string; value: string; strong?: boolean }[] = [{ label: "Subtotal", value: money(order.subtotal) }];
  if (order.promoTotal > 0) rows.push({ label: "Promociones", value: `−${money(order.promoTotal)}` });
  if (order.couponDiscount > 0) {
    rows.push({ label: order.couponCode ? `Cupón ${order.couponCode}` : "Cupón", value: `−${money(order.couponDiscount)}` });
  }
  if (order.paymentDiscount > 0) {
    const label = `${order.payment?.name ?? "Medio de pago"}${order.paymentDiscountPercent ? ` (${order.paymentDiscountPercent} %)` : ""}`;
    rows.push({ label, value: `−${money(order.paymentDiscount)}` });
  }
  const shipping =
    order.fulfillment === "pickup" || order.shippingCost === 0
      ? order.shippingZoneName?.startsWith("A coordinar")
        ? "A coordinar"
        : "Gratis"
      : money(order.shippingCost);
  rows.push({ label: order.fulfillment === "pickup" ? "Retiro" : "Envío", value: shipping });
  rows.push({ label: "Total", value: money(order.total), strong: true });
  return { t: "totals", rows };
}

/** Dónde y cómo se entrega. */
export function deliveryBlocks(order: OrderEmailData): Block[] {
  if (order.fulfillment === "pickup") {
    const p = order.pickup;
    return [
      { t: "section", title: "Retiro" },
      {
        t: "rows",
        rows: [
          { label: "Lugar", value: p?.name || "En el local" },
          { label: "Dirección", value: p?.address ?? "" },
          { label: "Horarios", value: p?.hoursText ?? "" },
        ],
      },
    ];
  }
  return [
    { t: "section", title: "Entrega" },
    { t: "p", content: order.deliveryText.replace(/^Envío a /, "") },
  ];
}

/** Pie de los mails al comprador: por qué le llega y cómo contactar a la tienda. */
export function buyerFooter(store: StoreEmailInfo): (Inline | Inline[])[] {
  const contact: Inline[] = [];
  if (store.contactEmail) contact.push("Respondé este mail para hablar con la tienda");
  if (store.whatsappUrl) {
    contact.push(store.contactEmail ? " o escribí por " : "Escribí a la tienda por ");
    contact.push({ href: store.whatsappUrl, label: "WhatsApp" });
  }
  if (contact.length) contact.push(".");
  return [
    `Recibís este mail porque hiciste un pedido en ${store.name}.`,
    ...(contact.length ? [contact] : []),
    [{ href: store.url, label: store.url.replace(/^https?:\/\//, "") }, " · Tienda hecha con Ecommy"],
  ];
}

/** Pie de los mails de cuenta (dueños de tienda). */
export function accountFooter(platformUrl: string | null, supportEmail: string | null): (Inline | Inline[])[] {
  const lines: (Inline | Inline[])[] = ["Recibís este mail porque tenés una cuenta en Ecommy."];
  if (supportEmail) lines.push(["¿Dudas? Respondé este mail o escribinos a ", { href: `mailto:${supportEmail}`, label: supportEmail }, "."]);
  if (platformUrl) lines.push([{ href: platformUrl, label: platformUrl.replace(/^https?:\/\//, "") }]);
  return lines;
}

/** Texto plano de instrucciones en markdown mínimo (sin `**`, `#`, links `[x](y)`). */
export function plainInstructions(md: string | null | undefined): string {
  return (md ?? "")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
    .replace(/^[-*]\s+/gm, "- ")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
