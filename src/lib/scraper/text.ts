/**
 * Utilidades de texto y precios del importador, portadas de
 * `scripts/scrape.mjs` (scraper original del catálogo DAZ) y ampliadas.
 * Puras: sirven en server y en tests.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  laquo: "«", raquo: "»", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", deg: "°", euro: "€",
  pound: "£", yen: "¥", cent: "¢", copy: "©",
  reg: "®", trade: "™", middot: "·", bull: "•",
  times: "×", divide: "÷", frac12: "½", frac14: "¼",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", iexcl: "¡", iquest: "¿", ordm: "º", ordf: "ª",
};

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** Decodifica entidades numéricas (`&#036;`, `&#x24;`) y las nombradas más comunes. */
export function decodeEntities(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (full, name: string) => {
      const hit = NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()];
      return hit === undefined ? full : hit;
    });
}

/** Quita tags HTML, decodifica entidades y normaliza espacios. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const withoutBlocks = String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutBlocks)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texto de una sola línea (nombres, marcas). */
export function cleanLine(value: string | null | undefined): string {
  return htmlToText(value).replace(/\s+/g, " ").trim();
}

/**
 * Parsea un monto escrito por humanos (formato argentino por defecto).
 *   "31.993" → 31993 · "1.234.567" → 1234567 · "1.234,50" → 1234.5
 *   "29900" → 29900 · "$ 12.990" → 12990 · "1,234.56" → 1234.56 (formato US)
 * Devuelve null si no hay dígitos.
 */
export function parseArsAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const token = String(raw).replace(/[^\d.,-]/g, "").trim();
  if (!/\d/.test(token)) return null;

  const negative = token.startsWith("-");
  let body = token.replace(/-/g, "");
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    // Ambos separadores: el último que aparece es el decimal.
    const decimalAt = Math.max(lastComma, lastDot);
    body = body.slice(0, decimalAt).replace(/[.,]/g, "") + "." + body.slice(decimalAt + 1).replace(/[.,]/g, "");
  } else if (lastComma !== -1) {
    const commas = body.split(",").length - 1;
    // Varias comas => separador de miles ("1,234,567"); una sola => decimal es-AR ("12,50").
    body = commas > 1 ? body.replace(/,/g, "") : body.replace(",", ".");
  } else if (lastDot !== -1) {
    const dots = body.split(".").length - 1;
    const tail = body.length - lastDot - 1;
    // Varios puntos, o un punto con exactamente 3 dígitos detrás => separador de miles.
    if (dots > 1 || tail === 3) body = body.replace(/\./g, "");
  }

  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Número "de máquina" ("12345.00", 12345) o, si no, formato humano. */
export function parseMachineAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return parseArsAmount(s);
}

/** Convierte el string de la Store API de WooCommerce a unidades mayores según `currency_minor_unit`. */
export function fromMinorUnit(value: string | number | null | undefined, minorUnit: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  const unit = Number.isFinite(Number(minorUnit)) ? Number(minorUnit) : 0;
  return n / Math.pow(10, unit);
}

/** Extrae los montos de un `price_html` de WooCommerce, en orden (ignora el tachado `<del>`). */
export function extractPriceHtmlAmounts(priceHtml: string | null | undefined): number[] {
  if (!priceHtml) return [];

  const cleaned = String(priceHtml)
    .replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, " ")
    .replace(/<span[^>]*class="[^"]*woocommerce-Price-currencySymbol[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "");

  const amounts: number[] = [];
  const spanRe = /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(cleaned)) !== null) {
    const n = parseArsAmount(htmlToText(m[1]));
    if (n !== null) amounts.push(n);
  }
  if (amounts.length) return amounts;

  const text = htmlToText(cleaned);
  const symRe = /(?:\$|ARS)\s*(-?[\d][\d.,]*)/g;
  while ((m = symRe.exec(text)) !== null) {
    const n = parseArsAmount(m[1]);
    if (n !== null) amounts.push(n);
  }
  if (amounts.length) return amounts;

  const numRe = /-?\d[\d.,]*/g;
  while ((m = numRe.exec(text)) !== null) {
    const n = parseArsAmount(m[0]);
    if (n !== null) amounts.push(n);
  }
  return amounts;
}

// ---------------------------------------------------------------------------
// Recargo y redondeo
// ---------------------------------------------------------------------------

export type RoundTo = 0 | 1 | 10 | 100 | 1000 | 990;

/**
 * Redondeo comercial HACIA ARRIBA (nunca se pierde margen):
 *   10/100/1000 → al múltiplo siguiente · 990 → termina en 990 (12.345 → 12.990)
 *   0 → sin redondeo (sólo centavos).
 */
export function roundPrice(value: number, roundTo: RoundTo | number = 0): number {
  if (!Number.isFinite(value)) return value;
  const v = Math.round((value + Number.EPSILON) * 100) / 100;
  if (!roundTo || roundTo <= 1) return v;
  if (roundTo === 990) {
    // El siguiente número terminado en 990 que sea >= v.
    return Math.ceil((v + 10) / 1000) * 1000 - 10;
  }
  return Math.ceil(v / roundTo - 1e-9) * roundTo;
}

/** Aplica el recargo del job (%) y el redondeo al precio de origen. */
export function applyMarkup(price: number | null | undefined, markupPercent: number, roundTo: RoundTo | number): number | null {
  if (price === null || price === undefined || !Number.isFinite(price) || price < 0) return null;
  const raised = price * (1 + (markupPercent || 0) / 100);
  return roundPrice(raised, roundTo);
}

/** Host sin `www.` ("https://www.tienda.com/x" → "tienda.com"). */
export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Origen normalizado ("https://tienda.com") o null si la URL no es válida. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

/** Resuelve una URL relativa contra una base (null si no se puede). */
export function absoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) return null;
  try {
    const u = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Quita duplicados conservando el orden. */
export function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Categorías "vacías" del origen ("–", "-", "Sin categoría", "Uncategorized"): no se importan. */
export function isJunkCategory(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return !n || /^[\s\-–—_.·]+$/.test(n) || /^(uncategori[sz]ed|sin categor[ií]a)$/i.test(n);
}
