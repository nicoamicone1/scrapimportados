/**
 * Adaptador Shopify: `/products.json?limit=N&page=P` (público en casi todas
 * las tiendas). Variantes con option1..3, `available` y `compare_at_price`;
 * imágenes por variante. La categoría sale del `product_type` (el JSON
 * público no trae las colecciones de cada producto).
 */
import { slugify } from "@/lib/slug";

import { fetchJson, fetchRaw, ScrapeError } from "../http";
import { cleanLine, htmlToText, originOf, parseMachineAmount, uniq } from "../text";
import type { FetchPageResult, NormalizedCategory, NormalizedProduct, NormalizedVariant, ScrapeAdapter } from "../types";

export interface ShopifyVariant {
  id: number;
  title: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  barcode?: string | null;
  available?: boolean;
  price: string | number;
  compare_at_price?: string | number | null;
  grams?: number | null;
  featured_image?: { src?: string } | null;
  inventory_quantity?: number | null;
}

export interface ShopifyImage {
  id: number;
  src: string;
  variant_ids?: number[];
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[] | string;
  variants: ShopifyVariant[];
  images?: ShopifyImage[];
  options?: { name: string; position?: number; values?: string[] }[];
}

function isDefaultOption(options: ShopifyProduct["options"]): boolean {
  return (
    !options?.length ||
    (options.length === 1 && options[0].name === "Title" && (options[0].values ?? []).every((v) => v === "Default Title"))
  );
}

/** Mapea un producto de `/products.json` al formato normalizado. */
export function mapShopifyProduct(p: ShopifyProduct, origin: string): NormalizedProduct {
  const name = cleanLine(p.title);
  const simple = isDefaultOption(p.options);
  const optionNames = simple ? [] : (p.options ?? []).map((o) => cleanLine(o.name));
  const imageByVariant = new Map<number, string>();
  for (const img of p.images ?? []) for (const vid of img.variant_ids ?? []) imageByVariant.set(vid, img.src);

  const variants: NormalizedVariant[] = p.variants.map((v) => {
    const raw = [v.option1, v.option2, v.option3];
    const optionValues: Record<string, string> = {};
    optionNames.forEach((n, i) => {
      const value = raw[i];
      if (value) optionValues[n] = cleanLine(value);
    });
    const price = parseMachineAmount(v.price);
    const compare = parseMachineAmount(v.compare_at_price);
    const inStock = v.available !== false;
    const qty = typeof v.inventory_quantity === "number" ? Math.max(0, v.inventory_quantity) : null;
    return {
      externalId: String(v.id),
      sku: v.sku?.trim() || null,
      barcode: v.barcode?.trim() || null,
      title: simple ? "Default" : Object.values(optionValues).join(" / ") || cleanLine(v.title),
      option_values: optionValues,
      price,
      compare_at_price: price !== null && compare !== null && compare > price ? compare : null,
      stock: inStock ? qty : 0,
      in_stock: inStock,
      image_url: v.featured_image?.src ?? imageByVariant.get(v.id) ?? null,
      weight_grams: typeof v.grams === "number" && v.grams > 0 ? v.grams : null,
    };
  });

  const options = optionNames.map((n, i) => ({
    name: n,
    values: uniq(
      (p.options?.[i]?.values ?? []).map((x) => cleanLine(x)).filter((x) => variants.some((v) => v.option_values[n] === x)),
    ),
  }));

  const productType = cleanLine(p.product_type ?? "").split(",")[0]?.trim() ?? "";
  const categories: NormalizedCategory[] = productType
    ? [{ externalId: `type:${slugify(productType)}`, name: productType, slug: slugify(productType), parentExternalId: null }]
    : [];

  const tags = Array.isArray(p.tags) ? p.tags : (p.tags ?? "").split(",");
  const text = htmlToText(p.body_html);
  return {
    externalId: String(p.id),
    name,
    slug: p.handle || slugify(name),
    description_html: p.body_html?.trim() || null,
    short_description: text ? text.slice(0, 280) : null,
    brand: p.vendor ? cleanLine(p.vendor) : null,
    tags: tags.map((t) => t.trim()).filter(Boolean),
    categories,
    images: uniq((p.images ?? []).map((i) => i.src).filter(Boolean)),
    options,
    variants,
    source_url: `${origin}/products/${p.handle}`,
    in_stock: variants.some((v) => v.in_stock !== false),
  };
}

export interface ShopifyCursor {
  page: number;
  perPage: number;
}

const PER_PAGE = 50;

export const shopifyAdapter: ScrapeAdapter<ShopifyCursor> = {
  id: "shopify",

  async detect(url) {
    const origin = originOf(url);
    if (!origin) return false;
    try {
      const { res, body } = await fetchRaw(`${origin}/products.json?limit=1`, {
        accept: "application/json",
        attempts: 1,
        allow404: true,
      });
      if (res.status === 404) return false;
      const data = JSON.parse(new TextDecoder().decode(body)) as { products?: unknown };
      return Array.isArray(data.products);
    } catch (err) {
      if (err instanceof ScrapeError && /bloquea/.test(err.message)) throw err;
      return false;
    }
  },

  async discover() {
    // El JSON público no informa el total: se cuenta mientras se recorre.
    return { total: null, cursor: { page: 1, perPage: PER_PAGE } };
  },

  async fetchPage(url, cursor): Promise<FetchPageResult<ShopifyCursor>> {
    const origin = originOf(url);
    if (!origin) throw new ScrapeError("La URL no es válida.");
    const { data } = await fetchJson<{ products?: ShopifyProduct[] }>(
      `${origin}/products.json?limit=${cursor.perPage}&page=${cursor.page}`,
    );
    const list = Array.isArray(data.products) ? data.products : [];
    return {
      products: list.map((p) => mapShopifyProduct(p, origin)),
      next: list.length === cursor.perPage ? { ...cursor, page: cursor.page + 1 } : null,
    };
  },
};
