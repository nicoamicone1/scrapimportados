import "server-only";

/**
 * "Detectar": identifica el tipo de tienda, estima la cantidad de productos
 * y trae una muestra de 3 (nombre, precio, imagen) sin tocar la base.
 */
import { detectAdapter } from "./adapters";
import { jsonldAdapter } from "./adapters/jsonld";
import { shopifyAdapter } from "./adapters/shopify";
import { woocommerceAdapter } from "./adapters/woocommerce";
import type { NormalizedProduct, UrlAdapterId } from "./types";

export interface DetectSample {
  name: string;
  price: number | null;
  compareAt: number | null;
  image: string | null;
  variants: number;
  url: string;
}

export interface DetectResult {
  adapter: UrlAdapterId;
  total: number | null;
  categories: number;
  sample: DetectSample[];
}

function toSample(p: NormalizedProduct): DetectSample {
  const prices = p.variants.map((v) => v.price).filter((n): n is number => n !== null);
  const min = prices.length ? Math.min(...prices) : null;
  const variant = p.variants.find((v) => v.price === min);
  return {
    name: p.name,
    price: min,
    compareAt: variant?.compare_at_price ?? null,
    image: p.images[0] ?? p.variants.find((v) => v.image_url)?.image_url ?? null,
    variants: p.variants.length,
    url: p.source_url,
  };
}

export async function detectSource(url: string, choice: UrlAdapterId | "auto", limit = 300): Promise<DetectResult> {
  const adapter = choice === "auto" ? await detectAdapter(url) : choice;

  if (adapter === "woocommerce") {
    const d = await woocommerceAdapter.discover(url, { limit });
    const page = await woocommerceAdapter.fetchPage(url, { ...d.cursor, perPage: 3 });
    return { adapter, total: d.total, categories: d.categories?.length ?? 0, sample: page.products.slice(0, 3).map(toSample) };
  }
  if (adapter === "shopify") {
    const page = await shopifyAdapter.fetchPage(url, { page: 1, perPage: 3 });
    return { adapter, total: null, categories: 0, sample: page.products.slice(0, 3).map(toSample) };
  }
  const d = await jsonldAdapter.discover(url, { limit });
  const page = await jsonldAdapter.fetchPage(url, { urls: d.cursor.urls.slice(0, 4), index: 0 });
  return { adapter, total: d.total, categories: 0, sample: page.products.slice(0, 3).map(toSample) };
}
