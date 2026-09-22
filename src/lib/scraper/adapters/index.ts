import { ScrapeError } from "../http";
import type { ScrapeAdapter, UrlAdapterId } from "../types";
import { jsonldAdapter } from "./jsonld";
import { shopifyAdapter } from "./shopify";
import { woocommerceAdapter } from "./woocommerce";

// Los cursores de cada adaptador son distintos; el motor los guarda como JSON.
type AnyAdapter = ScrapeAdapter<never>;

const ADAPTERS: Record<UrlAdapterId, AnyAdapter> = {
  woocommerce: woocommerceAdapter as unknown as AnyAdapter,
  shopify: shopifyAdapter as unknown as AnyAdapter,
  jsonld: jsonldAdapter as unknown as AnyAdapter,
};

/** Adaptador con cursor opaco (JSON). */
export interface OpaqueAdapter {
  id: UrlAdapterId;
  discover: (url: string, opts: { limit: number }) => ReturnType<ScrapeAdapter<unknown>["discover"]>;
  fetchPage: (url: string, cursor: unknown) => ReturnType<ScrapeAdapter<unknown>["fetchPage"]>;
}

export function getAdapter(id: UrlAdapterId): OpaqueAdapter {
  const a = ADAPTERS[id] as unknown as ScrapeAdapter<unknown>;
  return {
    id,
    discover: (url, opts) => a.discover(url, opts),
    fetchPage: (url, cursor) => a.fetchPage(url, cursor),
  };
}

/**
 * Detecta el tipo de tienda: Shopify y WooCommerce por su API pública; si
 * ninguna responde, el genérico (JSON-LD).
 */
export async function detectAdapter(url: string): Promise<UrlAdapterId> {
  if (await shopifyAdapter.detect(url)) return "shopify";
  if (await woocommerceAdapter.detect(url)) return "woocommerce";
  if (await jsonldAdapter.detect(url)) return "jsonld";
  throw new ScrapeError("No pudimos leer ese sitio. Revisá la dirección o probá más tarde.");
}
