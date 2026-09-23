import type { MetadataRoute } from "next";

import { listCategories } from "@/lib/store/categories";
import { getPublishedPage } from "@/lib/store/pages";
import { POLICY_LINKS } from "@/lib/store/policies";
import { getCatalogIndex } from "@/lib/store/products";
import { getSettings } from "@/lib/store/settings";
import { listPublishedPages } from "@/lib/store/sitemap";
import { getTenant } from "@/lib/tenant/resolve";
import { storeUrl } from "@/lib/tenant/urls";

// Se genera por request (las lecturas están cacheadas con tags): nada de build-time.
export const dynamic = "force-dynamic";

/**
 * Sitemap de UNA tienda (P0-01): `/sitemap.xml` en su subdominio/dominio
 * (el proxy reescribe a `/s/<slug>/sitemap.xml`) o `/s/<slug>/sitemap.xml`
 * en modo fallback. Productos activos, categorías visibles, páginas
 * publicadas y políticas, con URLs absolutas de `storeUrl()`.
 *
 * Un sitemap no recibe `params`: la tienda sale de los headers del proxy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { store } = await getTenant();
  if (!store) return [];
  const [settings, products, categories, pages, home] = await Promise.all([
    getSettings(store.id),
    getCatalogIndex(store.id),
    listCategories(store.id),
    listPublishedPages(store.id),
    getPublishedPage(store.id, "home"),
  ]);
  if (settings.maintenance.enabled) return [];

  const url = (path: string) => storeUrl(store, path);
  const hide = settings.catalog.out_of_stock_display === "hide";
  const latestProduct = products.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), "");

  return [
    { url: url("/"), lastModified: home?.publishedAt ?? settings.updated_at, changeFrequency: "daily", priority: 1 },
    { url: url("/productos"), lastModified: latestProduct || undefined, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({
      url: url(`/categoria/${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products
      .filter((p) => !hide || p.available)
      .map((p) => ({
        url: url(`/producto/${p.slug}`),
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        ...(p.image ? { images: [p.image] } : {}),
      })),
    ...pages.map((p) => ({ url: url(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...POLICY_LINKS.filter((p) => settings.policies[p.key]).map((p) => ({
      url: url(`/politicas/${p.slug}`),
      lastModified: settings.updated_at,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
    { url: url("/arrepentimiento"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
