/**
 * Extracción genérica de un producto desde el HTML de su página:
 * 1) JSON-LD `Product` / `ProductGroup` (con `offers` y `hasVariant`),
 * 2) microdata `itemtype=schema.org/Product`,
 * 3) Open Graph (`og:title`, `og:image`, `product:price:amount`).
 * Además descubre links de producto en listados y sitemaps.
 * Pura (cheerio): testeable con fixtures.
 */
import * as cheerio from "cheerio";

import { slugify } from "@/lib/slug";

import { absoluteUrl, cleanLine, htmlToText, parseMachineAmount, uniq } from "./text";
import type { NormalizedCategory, NormalizedProduct, NormalizedVariant } from "./types";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: JsonValue | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: JsonValue | undefined): JsonValue[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: JsonValue | undefined): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (isObject(v)) return str(v.name ?? v["@value"] ?? v.url);
  return null;
}

function typesOf(node: JsonObject): string[] {
  return asArray(node["@type"]).map((t) => String(t).replace(/^https?:\/\/schema\.org\//, ""));
}

/** Aplana @graph y arrays en una lista de nodos. */
function flattenNodes(value: JsonValue, out: JsonObject[] = [], depth = 0): JsonObject[] {
  if (depth > 6) return out;
  if (Array.isArray(value)) {
    for (const v of value) flattenNodes(v, out, depth + 1);
  } else if (isObject(value)) {
    out.push(value);
    if (value["@graph"]) flattenNodes(value["@graph"], out, depth + 1);
  }
  return out;
}

function parseJsonLoose(text: string): JsonValue | null {
  const trimmed = text.trim().replace(/^<!--|-->$/g, "").trim();
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    // Algunos sitios dejan saltos de línea crudos dentro de strings.
    try {
      return JSON.parse(trimmed.replace(/[\u0000-\u001f]+/g, " ")) as JsonValue;
    } catch {
      return null;
    }
  }
}

/** Quita el tamaño de miniatura de CDNs conocidos (Shopify `?width=100`) para bajar el original. */
export function fullSizeImage(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "cdn.shopify.com" || u.pathname.includes("/cdn/shop/")) {
      for (const k of ["width", "height", "crop"]) u.searchParams.delete(k);
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

function imagesOf(v: JsonValue | undefined, base: string): string[] {
  return asArray(v)
    .map((img) => (typeof img === "string" ? img : isObject(img) ? str(img.contentUrl ?? img.url) : null))
    .map((u) => absoluteUrl(u, base))
    .filter((u): u is string => Boolean(u))
    .map(fullSizeImage);
}

interface OfferInfo {
  price: number | null;
  compareAt: number | null;
  inStock: boolean | undefined;
  sku: string | null;
  name: string | null;
}

function availabilityInStock(v: JsonValue | undefined): boolean | undefined {
  const s = str(v);
  if (!s) return undefined;
  if (/out\s*of\s*stock|sold\s*out|discontinued|agotado|sin\s*stock/i.test(s)) return false;
  if (/in\s*stock|limited\s*availability|online\s*only|in\s*store\s*only|pre\s*order|back\s*order|disponible/i.test(s)) return true;
  return undefined;
}

function offerInfo(offer: JsonObject): OfferInfo {
  let price = parseMachineAmount(offer.price ?? offer.lowPrice ?? null);
  let compareAt: number | null = null;
  for (const spec of asArray(offer.priceSpecification)) {
    if (!isObject(spec)) continue;
    const p = parseMachineAmount(spec.price ?? null);
    const kind = str(spec.priceType) ?? "";
    if (p === null) continue;
    if (/ListPrice|StrikethroughPrice|MSRP/i.test(kind)) compareAt = p;
    else if (price === null) price = p;
  }
  if (price !== null && compareAt !== null && compareAt <= price) compareAt = null;
  return {
    price,
    compareAt,
    inStock: availabilityInStock(offer.availability),
    sku: str(offer.sku),
    name: str(offer.name),
  };
}

function offersOf(node: JsonObject): OfferInfo[] {
  const out: OfferInfo[] = [];
  for (const o of asArray(node.offers)) {
    if (!isObject(o)) continue;
    const nested = asArray(o.offers).filter(isObject);
    if (nested.length) out.push(...nested.map(offerInfo));
    else out.push(offerInfo(o));
  }
  return out;
}

const VARIANT_PROPS: Record<string, string> = {
  color: "Color",
  size: "Talle",
  material: "Material",
  pattern: "Estampa",
  suggestedAge: "Edad",
  suggestedGender: "Género",
};

function variantOptionValues(v: JsonObject, variesBy: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const prop of variesBy.length ? variesBy : Object.keys(VARIANT_PROPS)) {
    const key = prop.replace(/^https?:\/\/schema\.org\//, "");
    const value = str(v[key]);
    if (value) out[VARIANT_PROPS[key] ?? key] = cleanLine(value);
  }
  for (const ap of asArray(v.additionalProperty)) {
    if (!isObject(ap)) continue;
    const n = str(ap.name);
    const val = str(ap.value);
    if (n && val && !out[n]) out[cleanLine(n)] = cleanLine(val);
  }
  return out;
}

function categoriesFrom(v: JsonValue | undefined): { leaf: NormalizedCategory[]; defs: NormalizedCategory[] } {
  const raw = str(v);
  if (!raw) return { leaf: [], defs: [] };
  const parts = raw
    .split(/\s*(?:>|\/|›|»)\s*/)
    .map((s) => cleanLine(s))
    .filter(Boolean)
    .slice(0, 4);
  const defs: NormalizedCategory[] = [];
  const slugs: string[] = [];
  let parent: string | null = null;
  for (const part of parts) {
    slugs.push(slugify(part));
    const id = `path:${slugs.join("/")}`;
    defs.push({ externalId: id, name: part, slug: slugify(part), parentExternalId: parent });
    parent = id;
  }
  const leaf = defs.length ? [defs[defs.length - 1]] : [];
  return { leaf, defs: defs.slice(0, -1) };
}

/** Busca el nodo Product/ProductGroup principal entre los JSON-LD de la página. */
function findProductNode($: cheerio.CheerioAPI): JsonObject | null {
  const nodes: JsonObject[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const parsed = parseJsonLoose($(el).text());
    if (parsed !== null) flattenNodes(parsed, nodes);
  });
  const products = nodes.filter((n) => typesOf(n).some((t) => t === "Product" || t === "ProductGroup"));
  // Preferimos ProductGroup (trae variantes) y después el que tenga offers.
  return (
    products.find((n) => typesOf(n).includes("ProductGroup")) ??
    products.find((n) => n.offers !== undefined) ??
    products[0] ??
    null
  );
}

function meta($: cheerio.CheerioAPI, key: string): string | null {
  const v = $(`meta[property="${key}"]`).attr("content") ?? $(`meta[name="${key}"]`).attr("content");
  return v?.trim() || null;
}

/** Path estable de una URL para usar como external_id ("/producto/remera-azul"). */
export function stablePathId(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  } catch {
    return url;
  }
}

/**
 * Extrae un producto normalizado del HTML de su página. Devuelve null si
 * la página no describe un producto (sin nombre).
 */
export function extractProductFromHtml(html: string, pageUrl: string): NormalizedProduct | null {
  const $ = cheerio.load(html);
  const canonical =
    absoluteUrl($('link[rel="canonical"]').attr("href"), pageUrl) ?? absoluteUrl(meta($, "og:url"), pageUrl) ?? pageUrl;
  const node = findProductNode($);

  // ---------------- microdata ----------------
  const md = $('[itemtype*="schema.org/Product"]').first();
  const mdProp = (prop: string): string | null => {
    if (!md.length) return null;
    const el = md.find(`[itemprop="${prop}"]`).first();
    if (!el.length) return null;
    return (el.attr("content") ?? el.attr("src") ?? el.attr("href") ?? el.text()).trim() || null;
  };

  const name = cleanLine(str(node?.name) ?? mdProp("name") ?? meta($, "og:title") ?? $("h1").first().text());
  if (!name) return null;

  const descriptionRaw = str(node?.description) ?? mdProp("description") ?? meta($, "og:description");
  const images = uniq([
    ...imagesOf(node?.image, canonical),
    ...(mdProp("image") ? [absoluteUrl(mdProp("image"), canonical)].filter((u): u is string => Boolean(u)) : []),
    ...$('meta[property="og:image"], meta[property="og:image:secure_url"]')
      .map((_, el) => absoluteUrl($(el).attr("content"), canonical))
      .get()
      .filter((u): u is string => Boolean(u))
      .map(fullSizeImage),
  ]).slice(0, 20);

  const brand = str(node?.brand) ?? mdProp("brand");
  const { leaf, defs } = categoriesFrom(node?.category);

  // ---------------- variantes ----------------
  const variants: NormalizedVariant[] = [];
  const optionMap = new Map<string, string[]>();
  const hasVariant = node ? asArray(node.hasVariant).filter(isObject) : [];
  if (node && hasVariant.length) {
    const variesBy = asArray(node.variesBy).map((v) => String(v));
    for (const v of hasVariant) {
      const offer = offersOf(v)[0];
      const optionValues = variantOptionValues(v, variesBy);
      for (const [k, val] of Object.entries(optionValues)) {
        const list = optionMap.get(k) ?? [];
        if (!list.includes(val)) list.push(val);
        optionMap.set(k, list);
      }
      variants.push({
        externalId: str(v.sku) ?? str(v["@id"]) ?? null,
        sku: str(v.sku) ?? offer?.sku ?? null,
        barcode: str(v.gtin13 ?? v.gtin ?? v.gtin12 ?? v.gtin14 ?? v.gtin8) ?? null,
        title: Object.values(optionValues).join(" / ") || cleanLine(str(v.name) ?? "Variante"),
        option_values: optionValues,
        price: offer?.price ?? null,
        compare_at_price: offer?.compareAt ?? null,
        in_stock: offer?.inStock,
        stock: offer?.inStock === false ? 0 : null,
        image_url: imagesOf(v.image, canonical)[0] ?? null,
      });
    }
    // Variantes sin opciones distinguibles: se numeran para no chocar.
    if (optionMap.size === 0 && variants.length > 1) {
      optionMap.set("Opción", variants.map((v, i) => v.title || `Opción ${i + 1}`));
      variants.forEach((v, i) => (v.option_values = { "Opción": optionMap.get("Opción")![i] }));
    }
  } else {
    const offers = node ? offersOf(node) : [];
    const distinct = offers.filter((o, i) => o.sku && offers.findIndex((x) => x.sku === o.sku) === i);
    if (distinct.length > 1) {
      const labels = uniq(distinct.map((o, i) => cleanLine(o.name ?? o.sku ?? `Opción ${i + 1}`)));
      if (labels.length === distinct.length) {
        optionMap.set("Opción", labels);
        distinct.forEach((o, i) =>
          variants.push({
            externalId: o.sku,
            sku: o.sku,
            title: labels[i],
            option_values: { "Opción": labels[i] },
            price: o.price,
            compare_at_price: o.compareAt,
            in_stock: o.inStock,
            stock: o.inStock === false ? 0 : null,
          }),
        );
      }
    }
    if (!variants.length) {
      const first = offers.find((o) => o.price !== null) ?? offers[0];
      const price =
        first?.price ??
        parseMachineAmount(mdProp("price")) ??
        parseMachineAmount(meta($, "product:price:amount") ?? meta($, "og:price:amount"));
      const availability = first?.inStock ?? availabilityInStock(mdProp("availability") ?? meta($, "product:availability") ?? meta($, "og:availability"));
      variants.push({
        externalId: null,
        sku: str(node?.sku) ?? first?.sku ?? mdProp("sku"),
        barcode: str(node?.gtin13 ?? node?.gtin ?? node?.gtin12 ?? node?.gtin14 ?? node?.gtin8) ?? null,
        title: "Default",
        option_values: {},
        price,
        compare_at_price: first?.compareAt ?? null,
        in_stock: availability,
        stock: availability === false ? 0 : null,
      });
    }
  }

  const text = htmlToText(descriptionRaw);
  const descriptionHtml = descriptionRaw && /<[a-z][\s\S]*>/i.test(descriptionRaw)
    ? descriptionRaw
    : text
      ? text.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("")
      : null;

  return {
    externalId: stablePathId(canonical),
    name,
    slug: slugify(name),
    description_html: descriptionHtml,
    short_description: text ? text.slice(0, 280) : null,
    brand: brand ? cleanLine(brand) : null,
    tags: [],
    categories: leaf,
    categoryDefs: defs,
    images,
    options: [...optionMap].map(([n, values]) => ({ name: n, values })),
    variants,
    source_url: canonical,
    in_stock: variants.some((v) => v.in_stock !== false),
  };
}

// ---------------------------------------------------------------------------
// Descubrimiento de URLs de producto
// ---------------------------------------------------------------------------

const PRODUCT_PATH = /\/(productos?|products?|p|item|articulos?)\/[^/?#]+|-p-?\d+$/i;
const EXCLUDE_PATH = /\/(cart|carrito|checkout|account|cuenta|login|wp-admin|feed|tag|categor(y|ia)|collections?|search|buscar)\b|\.(jpe?g|png|webp|gif|pdf|css|js)(\?|$)/i;

/** ¿La URL parece la ficha de un producto? */
export function looksLikeProductUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return PRODUCT_PATH.test(u.pathname) && !EXCLUDE_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

/** Links de producto (mismo host) y links de paginación de un listado. */
export function extractListingLinks(html: string, pageUrl: string): { products: string[]; next: string | null } {
  const $ = cheerio.load(html);
  const host = new URL(pageUrl).host;
  const products: string[] = [];
  $("a[href]").each((_, el) => {
    const abs = absoluteUrl($(el).attr("href"), pageUrl);
    if (!abs) return;
    const u = new URL(abs);
    if (u.host !== host) return;
    u.hash = "";
    if (looksLikeProductUrl(u.toString())) products.push(u.toString());
  });
  const nextHref =
    $('link[rel="next"]').attr("href") ??
    $('a[rel="next"]').attr("href") ??
    $("a.next, .pagination a.next, a[aria-label*='Siguiente' i], a[aria-label*='Next' i]").first().attr("href");
  return { products: uniq(products), next: absoluteUrl(nextHref, pageUrl) };
}

/** `<loc>` de un sitemap y si es un índice de sitemaps. */
export function parseSitemap(xml: string): { isIndex: boolean; locs: string[] } {
  const $ = cheerio.load(xml, { xml: true });
  const isIndex = $("sitemapindex").length > 0;
  const locs = $(isIndex ? "sitemap > loc" : "url > loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  return { isIndex, locs };
}
