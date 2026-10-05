import { formatMoney, formatPercent } from "@/lib/money";
import { WA_MAX_MESSAGE } from "@/lib/store/whatsapp";

/**
 * Respuestas listas para WhatsApp (`/admin/responder`, PRODUCT-THESIS §4.2).
 * Lógica pura (server, client y tests): arma el texto a partir de datos ya
 * resueltos. Ecommy no manda nada: el comerciante copia o abre WhatsApp y
 * lo manda él. Sin emojis, en voseo y con la plata siempre en `formatMoney`.
 * Ningún mensaje pasa de `WA_MAX_MESSAGE` (wa.me trunca los largos).
 */

/** Hasta cuántas unidades se avisa "nos quedan las últimas". */
export const LOW_STOCK_REPLY = 3;

/** Variantes que se nombran una por una; con más, se cuentan. */
const MAX_LISTED = 6;

export interface ReplyVariant {
  id: string;
  /** null = producto sin opciones (la variante "Default"). */
  title: string | null;
  sku?: string | null;
  /** Precio final de la tienda (con promociones aplicadas). */
  price: number;
  /** Precio tachado en la tienda (null = no hay). */
  compareAt?: number | null;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
}

export interface ReplyProduct {
  name: string;
  /** URL pública absoluta de la ficha (`storeUrl(store, "/producto/<slug>")`). */
  url: string;
  variants: ReplyVariant[];
}

/** Producto encontrado en `/admin/responder` (lo devuelve `searchProductsForReply`). */
export interface ReplyProductHit extends ReplyProduct {
  id: string;
  slug: string;
  /** "active" | "draft" (los archivados no aparecen). */
  status: string;
  imageUrl: string | null;
  variants: (ReplyVariant & { sku: string | null })[];
}

/** Condiciones de la tienda que suman a la respuesta (0 = no se mencionan). */
export interface ReplyTerms {
  /** Mayor % de descuento de los métodos de transferencia activos. */
  transferDiscount: number;
  /** Cuotas sin interés con Mercado Pago conectado (0 = no hay). */
  freeInstallments: number;
  currency?: string;
  /** La ficha ofrece "Avisame cuando haya stock" (default true). */
  stockAlerts?: boolean;
}

export type StockLevel = "in" | "low" | "out";

/** Disponibilidad de una variante tal como la ve el cliente en la ficha. */
export function stockLevel(v: Pick<ReplyVariant, "stock" | "trackInventory" | "allowBackorder">): StockLevel {
  if (!v.trackInventory) return "in";
  if (v.stock <= 0) return v.allowBackorder ? "in" : "out";
  // Con venta sin stock no se promete "las últimas": se puede seguir pidiendo.
  if (!v.allowBackorder && v.stock <= LOW_STOCK_REPLY) return "low";
  return "in";
}

/**
 * Nombre de la variante como lo cargó el comercio ("Negro / M"), con las
 * barras parejas; null para la variante sin opciones ("Default"). La barra
 * se conserva: con comas se confundiría con la lista "S, M y L".
 */
export function variantLabel(title: string | null | undefined): string | null {
  const t = (title ?? "").trim();
  if (!t || t === "Default") return null;
  return t.split(/\s*\/\s*/).filter(Boolean).join(" / ");
}

/** Link de la ficha con la variante elegida (la ficha la preselecciona con `?variant=`). */
export function variantUrl(productUrl: string, variantId: string): string {
  return `${productUrl}${productUrl.includes("?") ? "&" : "?"}variant=${encodeURIComponent(variantId)}`;
}

/** "S", "S y M", "S, M y L". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function money(value: number, terms: Pick<ReplyTerms, "currency">): string {
  return formatMoney(value, { currency: terms.currency });
}

/** ", con 10 % menos pagando por transferencia o en 6 cuotas sin interés" ("" si no hay nada). */
function perksText(terms: ReplyTerms): string {
  const discount = terms.transferDiscount > 0 ? formatPercent(terms.transferDiscount) : null;
  const installments = terms.freeInstallments > 1 ? terms.freeInstallments : 0;
  if (discount && installments) return `, con ${discount} menos pagando por transferencia o en ${installments} cuotas sin interés`;
  if (discount) return `, con ${discount} menos pagando por transferencia`;
  if (installments) return ` o en ${installments} cuotas sin interés`;
  return "";
}

/** "Sale $ 24.900 (antes $ 29.900), con 10 % menos…" o "Sale entre $ 20.000 y $ 24.900…". */
function priceSentence(variants: ReplyVariant[], terms: ReplyTerms): string {
  const prices = variants.map((v) => v.price).filter((p) => Number.isFinite(p));
  if (!prices.length) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  let price: string;
  if (max > min) price = `entre ${money(min, terms)} y ${money(max, terms)}`;
  else {
    price = money(min, terms);
    const compare = variants.length === 1 ? variants[0].compareAt : null;
    if (compare && compare > min) price += ` (antes ${money(compare, terms)})`;
  }
  return `Sale ${price}${min > 0 ? perksText(terms) : ""}.`;
}

function lowStockSentence(v: ReplyVariant): string | null {
  if (stockLevel(v) !== "low") return null;
  return v.stock === 1 ? "Nos queda la última unidad." : `Nos quedan las últimas ${v.stock} unidades.`;
}

/** "Remera en S, M y L" o, si son muchas, "Remera en 8 opciones". */
function withOptions(name: string, labels: string[], compact: boolean): string {
  if (!labels.length) return name;
  if (compact || labels.length > MAX_LISTED) return `${name}, en ${labels.length} ${labels.length === 1 ? "opción" : "opciones"}`;
  return `${name} en ${listJoin(labels)}`;
}

/** "Por ahora no nos queda X.{ Sí tenemos en S y M.} Si querés, dejá tu mail…: link". */
function outSentence(name: string, link: string, terms: ReplyTerms, alternative = ""): string {
  const tail =
    terms.stockAlerts !== false
      ? `Si querés, dejá tu mail en la ficha y te avisamos apenas vuelva: ${link}`
      : `Podés ver el producto acá: ${link}`;
  return [`Por ahora no nos queda ${name}.`, alternative, tail].filter(Boolean).join(" ");
}

/**
 * Si el texto pasa de `max`, se arma de nuevo en versión compacta (cuenta
 * las variantes en lugar de nombrarlas) y, si todavía no entra, se acorta
 * el nombre del producto. El link nunca se corta.
 */
function fit(build: (compact: boolean, name: string) => string, name: string, max: number): string {
  let text = build(false, name);
  if (text.length <= max) return text;
  text = build(true, name);
  if (text.length <= max) return text;
  const over = text.length - max;
  const short = name.length - over - 1 > 0 ? `${name.slice(0, name.length - over - 1).trimEnd()}…` : "";
  return build(true, short || name.slice(0, 1)).slice(0, max);
}

/**
 * Respuesta para "¿tenés…?". Con `variantId`, sobre esa variante; sin él, sobre
 * el producto entero (rango de precios y qué variantes hay).
 */
export function productReply(product: ReplyProduct, terms: ReplyTerms, variantId?: string | null, max = WA_MAX_MESSAGE): string {
  const variants = product.variants;
  const chosen = variantId ? variants.find((v) => v.id === variantId) : undefined;
  const single = !chosen && variants.length === 1 ? variants[0] : undefined;
  const target = chosen ?? single;

  if (target) {
    const label = variantLabel(target.title);
    const link = chosen && variants.length > 1 ? variantUrl(product.url, chosen.id) : product.url;
    return fit(
      (compact, baseName) => {
        const name = label ? `${baseName} en ${label}` : baseName;
        if (stockLevel(target) === "out") {
          const others = variants.filter((v) => v.id !== target.id && stockLevel(v) !== "out");
          const labels = others.map((v) => variantLabel(v.title)).filter((l): l is string => Boolean(l));
          // Si hay otras variantes con stock, se ofrecen antes del link.
          const alt = labels.length && !compact ? `Sí tenemos en ${labels.length > MAX_LISTED ? `otras ${labels.length} opciones` : listJoin(labels)}.` : "";
          return outSentence(name, link, terms, alt);
        }
        return [`Sí, tenemos ${name}.`, lowStockSentence(target), priceSentence([target], terms), `Podés comprarlo acá: ${link}`]
          .filter(Boolean)
          .join(" ");
      },
      product.name,
      max,
    );
  }

  const available = variants.filter((v) => stockLevel(v) !== "out");
  const outOfStock = variants.filter((v) => stockLevel(v) === "out");
  return fit(
    (compact, name) => {
      if (!available.length) return outSentence(name, product.url, terms);
      const inLabels = available.map((v) => variantLabel(v.title)).filter((l): l is string => Boolean(l));
      const outLabels = outOfStock.map((v) => variantLabel(v.title)).filter((l): l is string => Boolean(l));
      const parts = [`Sí, tenemos ${withOptions(name, inLabels, compact)}.`];
      if (outLabels.length && !compact && outLabels.length <= MAX_LISTED) parts.push(`En ${listJoin(outLabels)} por ahora no nos queda.`);
      parts.push(priceSentence(available, terms), `Podés comprarlo acá: ${product.url}`);
      return parts.filter(Boolean).join(" ");
    },
    product.name,
    max,
  );
}

// ---------------------------------------------------------------------
// Lo que preguntan siempre: envío, retiro y pago
// ---------------------------------------------------------------------

export interface ReplyZone {
  name: string;
  cost: number;
  freeOver: number | null;
  etaText: string | null;
}

export interface ReplyPickup {
  name: string;
  address: string | null;
  hoursText: string | null;
}

/** "A CABA", "Al resto del país", "Al Palomar" (para "El Palomar"). */
export function zoneTarget(name: string): string {
  const n = name.trim();
  if (/^el\s/i.test(n)) return `Al ${n.slice(3).trim()}`;
  if (/^(resto|interior)\b/i.test(n)) return `Al ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  return `A ${n}`;
}

/** " y llega en 24 a 48 hs" / ". Plazo de entrega: mismo día" ("" sin plazo). */
function etaText(eta: string | null): string {
  const e = (eta ?? "").trim().replace(/\.+$/, "");
  if (!e) return "";
  if (/^\d/.test(e)) return ` y llega en ${e}`;
  if (/^en\s/i.test(e)) return ` y llega ${e.charAt(0).toLowerCase()}${e.slice(1)}`;
  return `. Plazo de entrega: ${e.charAt(0).toLowerCase()}${e.slice(1)}`;
}

/** "A CABA el envío sale $ 3.500 y llega en 24 a 48 hs. Gratis en compras desde $ 60.000." */
export function zoneReply(zone: ReplyZone, terms: Pick<ReplyTerms, "currency"> = {}): string {
  const cost = zone.cost > 0 ? `sale ${money(zone.cost, terms)}` : "es gratis";
  let text = `${zoneTarget(zone.name)} el envío ${cost}${etaText(zone.etaText)}.`;
  if (zone.cost > 0 && zone.freeOver !== null && zone.freeOver > 0) text += ` Gratis en compras desde ${money(zone.freeOver, terms)}.`;
  return text.slice(0, WA_MAX_MESSAGE);
}

/** "Envío gratis desde $ 90.000, a cualquier zona donde llegamos." */
export function freeShippingReply(amount: number, terms: Pick<ReplyTerms, "currency"> = {}, storeLink?: string | null): string {
  let text = `Envío gratis desde ${money(amount, terms)}, a cualquier zona donde llegamos. Por debajo de ese monto, el costo depende de la zona.`;
  if (storeLink) text += ` Podés armar el pedido acá: ${storeLink}`;
  return text;
}

/** "Podés retirar tu pedido sin cargo en Local Palermo, Av. Santa Fe 3253. Horarios: …" */
export function pickupReply(p: ReplyPickup): string {
  const place = [p.name.trim(), (p.address ?? "").trim()].filter(Boolean).join(", ");
  let text = `Podés retirar tu pedido sin cargo en ${place}.`;
  const hours = (p.hoursText ?? "").trim().replace(/\.+$/, "");
  if (hours) text += ` Horarios: ${hours}.`;
  return text.slice(0, WA_MAX_MESSAGE);
}

export interface ReplyPayments {
  /** Hay un método de transferencia activo. */
  transfer: boolean;
  transferDiscount: number;
  alias?: string | null;
  cbu?: string | null;
  holder?: string | null;
  bankName?: string | null;
  /** Mercado Pago conectado y activo (tarjeta). */
  card: boolean;
  freeInstallments: number;
  /** Efectivo activo, con su descuento (0 = sin descuento). */
  cash?: { discount: number } | null;
  currency?: string;
}

function bankLines(p: ReplyPayments): string[] {
  const lines: string[] = [];
  if (p.alias?.trim()) lines.push(`Alias: ${p.alias.trim().toUpperCase()}`);
  if (p.cbu?.trim()) lines.push(`CBU/CVU: ${p.cbu.trim()}`);
  if (p.holder?.trim()) lines.push(`Titular: ${p.holder.trim()}`);
  if (p.bankName?.trim()) lines.push(`Banco: ${p.bankName.trim()}`);
  return lines;
}

/** ¿Hay algo para contestar "cómo te pago"? */
export function hasPaymentInfo(p: ReplyPayments): boolean {
  return p.transfer || p.card || Boolean(p.cash);
}

/** "Cómo pagar": transferencia (con descuento), tarjeta y cuotas, efectivo. "" si no hay métodos. */
export function paymentReply(p: ReplyPayments): string {
  const sentences: string[] = [];
  if (p.transfer) {
    sentences.push(
      p.transferDiscount > 0
        ? `Podés pagar por transferencia con ${formatPercent(p.transferDiscount)} menos.`
        : "Podés pagar por transferencia.",
    );
  }
  if (p.card) {
    const how = p.freeInstallments > 1 ? `, en hasta ${p.freeInstallments} cuotas sin interés` : "";
    sentences.push(`${sentences.length ? "También con" : "Podés pagar con"} tarjeta de crédito o débito por Mercado Pago${how}.`);
  }
  if (p.cash) {
    const off = p.cash.discount > 0 ? ` con ${formatPercent(p.cash.discount)} menos` : "";
    sentences.push(sentences.length ? `Y en efectivo${off}.` : `Podés pagar en efectivo${off}.`);
  }
  if (!sentences.length) return "";
  const lines = [sentences.join(" ")];
  const bank = p.transfer ? bankLines(p) : [];
  if (bank.length) lines.push("", "Datos para transferir:", ...bank);
  return lines.join("\n").slice(0, WA_MAX_MESSAGE);
}

/** "Datos para transferir" sueltos (alias, CBU, titular). "" si no hay transferencia o datos. */
export function transferReply(p: ReplyPayments): string {
  if (!p.transfer) return "";
  const bank = bankLines(p);
  if (!bank.length) return "";
  const head = p.transferDiscount > 0 ? `Te paso los datos. Pagando por transferencia tenés ${formatPercent(p.transferDiscount)} menos.` : "Te paso los datos para transferir.";
  return [head, "", ...bank, "", "Cuando transfieras, mandanos el comprobante por acá."].join("\n").slice(0, WA_MAX_MESSAGE);
}
