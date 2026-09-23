import { formatMoney, formatPercent } from "@/lib/money";

/**
 * Mensajes listos para pegar de `/admin/compartir` (puro: server, client y
 * tests). Sólo usan datos reales de la tienda: si no hay descuento por
 * transferencia o envío gratis, la línea no aparece.
 */

export interface ShareFacts {
  storeName: string;
  /** URL absoluta de la tienda. */
  url: string;
  /** Mayor % de descuento de los métodos de transferencia activos (0 = no hay). */
  transferDiscount: number;
  /** "Envío gratis desde" que vale para todas las zonas activas (null = no hay; ver `freeShippingThreshold`). */
  freeShippingFrom: number | null;
  currency?: string;
}

export interface ShareMessage {
  id: "bio" | "reply" | "story";
  title: string;
  hint: string;
  text: string;
}

/** Límite de la bio de Instagram. */
export const INSTAGRAM_BIO_MAX = 150;

/** "taller-luna.ecommy.app" (sin protocolo ni barra final). */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/**
 * Umbral de "envío gratis desde" que se puede prometer sin mentir: sólo si
 * TODAS las zonas activas tienen envío gratis a partir de un monto, y se
 * toma el mayor (a partir de ahí es gratis vaya a donde vaya). Si alguna
 * zona activa no tiene envío gratis, o no hay zonas, devuelve null.
 */
export function freeShippingThreshold(zones: { free_over: number | string | null }[]): number | null {
  if (!zones.length) return null;
  let max = 0;
  for (const z of zones) {
    const v = z.free_over === null ? NaN : Number(z.free_over);
    if (!Number.isFinite(v) || v <= 0) return null;
    max = Math.max(max, v);
  }
  return max;
}

function perks(f: ShareFacts): { discount: string | null; shipping: string | null } {
  return {
    discount: f.transferDiscount > 0 ? formatPercent(f.transferDiscount) : null,
    shipping: f.freeShippingFrom !== null ? formatMoney(f.freeShippingFrom, { currency: f.currency }) : null,
  };
}

export function bioMessage(f: ShareFacts): string {
  const { discount, shipping } = perks(f);
  const lines = ["Precios y stock al día en la web."];
  if (discount) lines.push(`${discount} off pagando con transferencia.`);
  if (shipping) lines.push(`Envío gratis desde ${shipping}.`);
  lines.push(displayUrl(f.url));
  const text = lines.join("\n");
  // Si no entra en la bio, se sacan primero las líneas de beneficios.
  if (text.length <= INSTAGRAM_BIO_MAX) return text;
  return [lines[0], lines[lines.length - 1]].join("\n");
}

export function replyMessage(f: ShareFacts): string {
  const { discount, shipping } = perks(f);
  let text = `Hola, te paso el catálogo completo con precios y stock: ${f.url}`;
  if (discount) text += `\nCon transferencia tenés ${discount} off.`;
  if (shipping) text += `${discount ? " " : "\n"}Envío gratis desde ${shipping}.`;
  text += "\nArmás el pedido en la web y me llega directo. Cualquier duda, escribime por acá.";
  return text;
}

export function storyMessage(f: ShareFacts): string {
  const { discount, shipping } = perks(f);
  const lines = [`${f.storeName} ya tiene tienda online.`, "Todo el catálogo con precios y stock al día."];
  if (discount) lines.push(`${discount} off pagando con transferencia.`);
  if (shipping) lines.push(`Envío gratis desde ${shipping}.`);
  lines.push(`Entrá a ${displayUrl(f.url)}`);
  return lines.join("\n");
}

export function shareMessages(f: ShareFacts): ShareMessage[] {
  return [
    {
      id: "bio",
      title: "Bio de Instagram",
      hint: "Pegá el link en los enlaces del perfil de Instagram (el texto de la bio no admite links).",
      text: bioMessage(f),
    },
    {
      id: "reply",
      title: "Respuesta por WhatsApp",
      hint: "Para cuando te preguntan el precio. Guardalo como respuesta rápida en WhatsApp Business.",
      text: replyMessage(f),
    },
    {
      id: "story",
      title: "Historia o estado",
      hint: "Para una historia de Instagram o un estado de WhatsApp. En Instagram sumá el sticker de enlace.",
      text: storyMessage(f),
    },
  ];
}

/** Link `wa.me` sin destinatario: WhatsApp pide elegir el chat. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "Mirá Mate de calabaza: $ 12.500 · https://…" (sin precio si no hay). */
export function productMessage(p: { name: string; price: number | null; maxPrice?: number | null; url: string; currency?: string }): string {
  let price = "";
  if (p.price !== null && Number.isFinite(p.price)) {
    const from = p.maxPrice !== null && p.maxPrice !== undefined && p.maxPrice > p.price;
    price = `: ${from ? "desde " : ""}${formatMoney(p.price, { currency: p.currency })}`;
  }
  return `Mirá ${p.name}${price} · ${p.url}`;
}

/** "Mirá Mates en Taller Luna: https://…" */
export function categoryMessage(c: { name: string; storeName: string; url: string }): string {
  return `Mirá ${c.name} en ${c.storeName}: ${c.url}`;
}
