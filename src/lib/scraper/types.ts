/**
 * Tipos del importador (agente G). Todo adaptador (WooCommerce, Shopify,
 * JSON-LD genérico, CSV) produce `NormalizedProduct`; la fase "apply" sólo
 * conoce este formato.
 */

export type AdapterId = "woocommerce" | "shopify" | "jsonld" | "csv";

/** Adaptadores que se alimentan de una URL (el CSV entra por archivo). */
export type UrlAdapterId = Exclude<AdapterId, "csv">;

export const ADAPTER_LABELS: Record<AdapterId | "generic", string> = {
  woocommerce: "WooCommerce",
  shopify: "Shopify",
  jsonld: "Genérico (JSON-LD)",
  generic: "Genérico",
  csv: "Archivo CSV",
};

export interface NormalizedCategory {
  externalId: string;
  name: string;
  slug: string;
  parentExternalId?: string | null;
}

export interface NormalizedOption {
  name: string;
  values: string[];
}

export interface NormalizedVariant {
  externalId?: string | null;
  sku?: string | null;
  barcode?: string | null;
  /** "Rojo / M" o "Default". */
  title: string;
  /** `{"Color":"Rojo","Talle":"M"}`; `{}` en productos simples. */
  option_values: Record<string, string>;
  /** Precio de ORIGEN (antes del recargo del job). */
  price: number | null;
  compare_at_price?: number | null;
  cost?: number | null;
  /** Stock conocido; `null`/ausente = la fuente no lo informa. */
  stock?: number | null;
  in_stock?: boolean;
  image_url?: string | null;
  weight_grams?: number | null;
}

export interface NormalizedProduct {
  externalId: string;
  name: string;
  slug?: string;
  description_html?: string | null;
  short_description?: string | null;
  brand?: string | null;
  tags: string[];
  /** Categorías a las que se vincula el producto (hojas). */
  categories: NormalizedCategory[];
  /** Definiciones extra (ancestros) para armar la jerarquía. */
  categoryDefs?: NormalizedCategory[];
  images: string[];
  options: NormalizedOption[];
  variants: NormalizedVariant[];
  source_url: string;
  in_stock?: boolean;
  /** Campos opcionales que trae el CSV de creación. */
  status?: "draft" | "active" | "archived" | null;
  seo?: { title?: string; description?: string } | null;
}

/** Resultado de pedir una página a un adaptador. */
export interface FetchPageResult<C> {
  products: NormalizedProduct[];
  /** Cursor para la siguiente página; `null` = terminó. */
  next: C | null;
  /** Categorías descubiertas (se guardan en el cursor del job). */
  categories?: NormalizedCategory[];
  /** Advertencias no fatales (se escriben en el log). */
  warnings?: string[];
}

export interface DiscoverResult<C> {
  /** Cantidad estimada de productos (null = desconocida). */
  total: number | null;
  /** Cursor inicial para `fetchPage`. */
  cursor: C;
  categories?: NormalizedCategory[];
  warnings?: string[];
}

export interface ScrapeAdapter<C = unknown> {
  id: UrlAdapterId;
  /** ¿La URL corresponde a este tipo de tienda? (hace requests livianos). */
  detect(url: string): Promise<boolean>;
  /** Prepara el recorrido y estima la cantidad. */
  discover(url: string, opts: { limit: number }): Promise<DiscoverResult<C>>;
  /** Trae una página de productos normalizados. */
  fetchPage(url: string, cursor: C): Promise<FetchPageResult<C>>;
}
