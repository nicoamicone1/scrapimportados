/**
 * Tags de caché del storefront por tienda (spec §14.2).
 *
 *   unstable_cache(fn, ["store-products", storeId], { tags: [tagFor("products", storeId)] })
 *   revalidateTag(tagFor("products", ctx.store.id), "max")
 *   revalidateTag(tagFor("product", ctx.store.id, slug), "max")   // una ficha
 *
 * Formato: `<base>:<storeId>` o `<base>:<storeId>:<clave>`. Nunca uses la
 * tag "pelada" (`"products"`): invalidaría el caché de todas las tiendas…
 * o, peor, ninguno.
 */

export const CACHE_TAG_BASES = [
  "settings",
  "menus",
  "products",
  /** Una ficha: `tagFor("product", storeId, slug)`. */
  "product",
  "categories",
  "promotions",
  "pages",
  /** Una página del builder: `tagFor("page", storeId, slug)`. */
  "page",
  "shipping",
  "payment-methods",
  "redirects",
] as const;

export type CacheTagBase = (typeof CACHE_TAG_BASES)[number];

export function tagFor(base: CacheTagBase, storeId: string, key?: string): string {
  return key ? `${base}:${storeId}:${key}` : `${base}:${storeId}`;
}

/** Tag de la fila `stores` resuelta por slug (getStoreBySlug). */
export function storeTag(slug: string): string {
  return `store:${slug}`;
}

/** Tag de la fila `stores` resuelta por dominio propio (getStoreByDomain). */
export function storeDomainTag(domain: string): string {
  return `store-domain:${domain}`;
}
