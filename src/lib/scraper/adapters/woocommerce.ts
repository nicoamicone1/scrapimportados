/**
 * Adaptador WooCommerce: Store API pública (`/wp-json/wc/store/v1`), sin auth.
 * Productos paginados (`x-wp-totalpages`), categorías con jerarquía y
 * variaciones de productos variables (precio y stock por variación).
 */
import { slugify } from "@/lib/slug";

import { fetchJson, fetchRaw, ScrapeError } from "../http";
import { cleanLine, fromMinorUnit, htmlToText, isJunkCategory, originOf, uniq } from "../text";
import type { FetchPageResult, NormalizedCategory, NormalizedProduct, NormalizedVariant, ScrapeAdapter } from "../types";

// ------------------------------------------------------------------ tipos API

export interface WooPrices {
  price?: string | null;
  regular_price?: string | null;
  sale_price?: string | null;
  price_range?: { min_amount?: string | null; max_amount?: string | null } | null;
  currency_code?: string;
  currency_minor_unit?: number;
}

export interface WooTerm {
  id: number;
  name: string;
  slug: string;
}

export interface WooAttribute {
  id: number;
  name: string;
  taxonomy?: string | null;
  has_variations?: boolean;
  terms?: WooTerm[];
}

export interface WooProduct {
  id: number;
  name: string;
  slug?: string;
  parent?: number;
  type?: string;
  permalink?: string;
  sku?: string;
  short_description?: string;
  description?: string;
  on_sale?: boolean;
  prices?: WooPrices;
  price_html?: string;
  images?: { src?: string; alt?: string }[];
  categories?: WooTerm[];
  tags?: WooTerm[];
  brands?: WooTerm[];
  attributes?: WooAttribute[];
  variations?: { id: number; attributes?: { name: string; value: string | null }[] }[];
  is_in_stock?: boolean;
  low_stock_remaining?: number | null;
  weight?: string;
}

export interface WooCategory {
  id: number;
  name: string;
  slug: string;
  parent?: number;
}

// ------------------------------------------------------------------ mapeo puro

export function mapWooCategory(c: WooCategory): NormalizedCategory {
  return {
    externalId: String(c.id),
    name: cleanLine(c.name),
    slug: c.slug || slugify(cleanLine(c.name)),
    parentExternalId: c.parent ? String(c.parent) : null,
  };
}

/** Precio de lista (unidades mayores) y precio tachado si está en oferta. */
export function wooPrices(prices: WooPrices | undefined): { price: number | null; compareAt: number | null } {
  if (!prices) return { price: null, compareAt: null };
  const unit = prices.currency_minor_unit;
  let price = fromMinorUnit(prices.price, unit);
  if (price === null || price === 0) {
    const min = fromMinorUnit(prices.price_range?.min_amount, unit);
    if (min !== null && min > 0) price = min;
  }
  const regular = fromMinorUnit(prices.regular_price, unit);
  const compareAt = price !== null && regular !== null && regular > price ? regular : null;
  return { price, compareAt };
}

function wooStock(p: { is_in_stock?: boolean; low_stock_remaining?: number | null }): { stock: number | null; in_stock: boolean } {
  const inStock = p.is_in_stock !== false;
  const low = typeof p.low_stock_remaining === "number" ? p.low_stock_remaining : null;
  return { stock: inStock ? low : 0, in_stock: inStock };
}

/** Nombre legible de un valor de atributo (en variaciones viene el slug del término). */
function attributeValueLabel(attr: WooAttribute | undefined, value: string): string {
  if (!attr?.terms?.length) return cleanLine(value);
  const hit = attr.terms.find((t) => t.slug === value || t.name === value || slugify(t.name) === slugify(value));
  return cleanLine(hit?.name ?? value);
}

/**
 * Mapea un producto de la Store API al formato normalizado.
 * `variations`: detalle de cada variación (productos `variable`).
 * `categoryIndex`: categorías del sitio para completar el padre.
 */
export function mapWooProduct(
  p: WooProduct,
  opts: { categoryIndex?: Map<string, NormalizedCategory>; variations?: WooProduct[] } = {},
): NormalizedProduct {
  const name = cleanLine(p.name);
  const images = uniq((p.images ?? []).map((i) => i.src ?? "").filter(Boolean));
  const categories: NormalizedCategory[] = (p.categories ?? []).map((c) => {
    const known = opts.categoryIndex?.get(String(c.id));
    return known ?? { externalId: String(c.id), name: cleanLine(c.name), slug: c.slug, parentExternalId: null };
  });

  const variants: NormalizedVariant[] = [];
  const options: { name: string; values: string[] }[] = [];

  const variationRefs = p.type === "variable" ? p.variations ?? [] : [];
  if (variationRefs.length > 0) {
    const detailById = new Map((opts.variations ?? []).map((v) => [v.id, v]));
    const attrByName = new Map((p.attributes ?? []).map((a) => [a.name, a]));
    const valuesByOption = new Map<string, string[]>();

    for (const ref of variationRefs) {
      const optionValues: Record<string, string> = {};
      for (const a of ref.attributes ?? []) {
        const optName = cleanLine(a.name);
        // Valor vacío = "cualquiera" en WooCommerce.
        const label = a.value ? attributeValueLabel(attrByName.get(a.name), a.value) : "Cualquiera";
        optionValues[optName] = label;
        const list = valuesByOption.get(optName) ?? [];
        if (!list.includes(label)) list.push(label);
        valuesByOption.set(optName, list);
      }
      const detail = detailById.get(ref.id);
      const { price, compareAt } = wooPrices(detail?.prices ?? p.prices);
      const stock = wooStock(detail ?? p);
      variants.push({
        externalId: String(ref.id),
        sku: detail?.sku || null,
        title: Object.values(optionValues).join(" / ") || "Default",
        option_values: optionValues,
        price,
        compare_at_price: compareAt,
        stock: stock.stock,
        in_stock: stock.in_stock,
        image_url: detail?.images?.[0]?.src ?? null,
      });
    }
    for (const [optName, values] of valuesByOption) {
      // Orden de los términos del sitio cuando lo conocemos.
      const attr = attrByName.get(optName);
      const order = attr?.terms?.map((t) => cleanLine(t.name)) ?? [];
      values.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      options.push({ name: optName, values });
    }
  } else {
    const { price, compareAt } = wooPrices(p.prices);
    const stock = wooStock(p);
    variants.push({
      externalId: null,
      sku: p.sku || null,
      title: "Default",
      option_values: {},
      price,
      compare_at_price: compareAt,
      stock: stock.stock,
      in_stock: stock.in_stock,
    });
  }

  const shortText = htmlToText(p.short_description);
  return {
    externalId: String(p.id),
    name,
    slug: p.slug || slugify(name),
    description_html: (p.description ?? "").trim() || (p.short_description ?? "").trim() || null,
    short_description: shortText || null,
    brand: p.brands?.[0] ? cleanLine(p.brands[0].name) : null,
    tags: (p.tags ?? []).map((t) => cleanLine(t.name)).filter(Boolean),
    categories,
    images,
    options,
    variants,
    source_url: p.permalink ?? "",
    in_stock: variants.some((v) => v.in_stock !== false),
  };
}

// ------------------------------------------------------------------ red

export interface WooCursor {
  page: number;
  perPage: number;
  totalPages: number | null;
  /** 'pretty' = /wp-json/…; 'query' = /?rest_route=… (sin permalinks lindos). */
  api: "pretty" | "query";
  /** Raíz de WordPress (origen o subcarpeta, ej. https://sitio.com/tienda). */
  base?: string;
}

/** Candidatos a raíz de WordPress: el origen y, si hay, la primera carpeta. */
function baseCandidates(url: string): string[] {
  const origin = originOf(url);
  if (!origin) return [];
  const first = new URL(url).pathname.split("/").filter(Boolean)[0];
  return first && !/\.(php|html?)$/i.test(first) ? [origin, `${origin}/${first}`] : [origin];
}

function apiUrl(origin: string, api: WooCursor["api"], path: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  if (api === "pretty") return `${origin}/wp-json/wc/store/v1${path}?${qs}`;
  qs.set("rest_route", `/wc/store/v1${path}`);
  return `${origin}/?${qs}`;
}

async function probeBase(origin: string): Promise<{ api: WooCursor["api"]; total: number | null } | null> {
  for (const api of ["pretty", "query"] as const) {
    try {
      const { res, body } = await fetchRaw(apiUrl(origin, api, "/products", { per_page: 1 }), {
        accept: "application/json",
        attempts: 1,
        allow404: true,
      });
      if (res.status === 404) continue;
      const text = new TextDecoder().decode(body).trim();
      if (!text.startsWith("[")) continue;
      const total = Number(res.headers.get("x-wp-total"));
      return { api, total: Number.isFinite(total) ? total : null };
    } catch (err) {
      if (err instanceof ScrapeError && /bloquea/.test(err.message)) throw err;
    }
  }
  return null;
}

async function probe(url: string): Promise<{ base: string; api: WooCursor["api"]; total: number | null } | null> {
  for (const base of baseCandidates(url)) {
    const found = await probeBase(base);
    if (found) return { base, ...found };
  }
  return null;
}

const PER_PAGE = 25;

async function fetchCategories(origin: string, api: WooCursor["api"]): Promise<NormalizedCategory[]> {
  const out: NormalizedCategory[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, res } = await fetchJson<WooCategory[]>(apiUrl(origin, api, "/products/categories", { per_page: 100, page }));
    if (!Array.isArray(data)) break;
    out.push(...data.map(mapWooCategory).filter((c) => !isJunkCategory(c.name)));
    const totalPages = Number(res.headers.get("x-wp-totalpages"));
    if (!(Number.isFinite(totalPages) ? page < totalPages : data.length === 100)) break;
  }
  return out;
}

async function fetchVariations(origin: string, api: WooCursor["api"], p: WooProduct): Promise<WooProduct[]> {
  const refs = p.variations ?? [];
  if (!refs.length) return [];
  try {
    const { data } = await fetchJson<WooProduct[]>(
      apiUrl(origin, api, "/products", { type: "variation", parent: p.id, per_page: 100 }),
    );
    if (Array.isArray(data) && data.length) return data;
  } catch {
    // Algunos sitios no permiten filtrar por parent: probamos una por una.
  }
  const out: WooProduct[] = [];
  for (const ref of refs.slice(0, 50)) {
    try {
      const { data } = await fetchJson<WooProduct>(apiUrl(origin, api, `/products/${ref.id}`, {}));
      out.push(data);
    } catch {
      // Sin detalle: se usa el precio del padre.
    }
  }
  return out;
}

export const woocommerceAdapter: ScrapeAdapter<WooCursor> = {
  id: "woocommerce",

  async detect(url) {
    return (await probe(url)) !== null;
  },

  async discover(url) {
    const found = await probe(url);
    if (!found) throw new ScrapeError("No encontramos la API de WooCommerce en ese sitio.");
    const categories = await fetchCategories(found.base, found.api);
    return {
      total: found.total,
      categories,
      cursor: {
        page: 1,
        perPage: PER_PAGE,
        totalPages: found.total !== null ? Math.ceil(found.total / PER_PAGE) : null,
        api: found.api,
        base: found.base,
      },
    };
  },

  async fetchPage(url, cursor): Promise<FetchPageResult<WooCursor>> {
    const origin = cursor.base ?? originOf(url);
    if (!origin) throw new ScrapeError("La URL no es válida.");
    const { data, res } = await fetchJson<WooProduct[]>(
      apiUrl(origin, cursor.api, "/products", { per_page: cursor.perPage, page: cursor.page }),
    );
    if (!Array.isArray(data)) throw new ScrapeError("La API de WooCommerce devolvió un formato inesperado.");
    const totalPages = Number(res.headers.get("x-wp-totalpages"));
    const pages = Number.isFinite(totalPages) && totalPages > 0 ? totalPages : cursor.totalPages;

    const products: NormalizedProduct[] = [];
    const warnings: string[] = [];
    for (const p of data) {
      if (p.type === "grouped" || p.type === "external") {
        warnings.push(`Omitido "${cleanLine(p.name)}": tipo ${p.type} no soportado.`);
        continue;
      }
      const variations = p.type === "variable" ? await fetchVariations(origin, cursor.api, p) : [];
      products.push(mapWooProduct(p, { variations }));
    }

    const more = pages ? cursor.page < pages : data.length === cursor.perPage;
    return {
      products,
      warnings,
      next: more ? { ...cursor, page: cursor.page + 1, totalPages: pages ?? null } : null,
    };
  },
};
