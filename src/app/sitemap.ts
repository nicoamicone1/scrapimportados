import type { MetadataRoute } from "next";

import { listCategories } from "@/lib/store/categories";
import { getPublishedPage } from "@/lib/store/pages";
import { POLICY_LINKS } from "@/lib/store/policies";
import { getCatalogIndex } from "@/lib/store/products";
import { absoluteUrl } from "@/lib/store/seo";
import { getSettings } from "@/lib/store/settings";
import { listPublishedPages } from "@/lib/store/sitemap";

// Se genera por request (las lecturas están cacheadas con tags): nada de build-time.
export const dynamic = "force-dynamic";

/** /sitemap.xml (P0-01): productos activos, categorías visibles, páginas publicadas y políticas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, products, categories, pages, home] = await Promise.all([
    getSettings(),
    getCatalogIndex(),
    listCategories(),
    listPublishedPages(),
    getPublishedPage("home"),
  ]);
  if (settings.maintenance.enabled) return [];

  const hide = settings.catalog.out_of_stock_display === "hide";
  const latestProduct = products.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), "");

  return [
    { url: absoluteUrl("/"), lastModified: home?.publishedAt ?? settings.updated_at, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/productos"), lastModified: latestProduct || undefined, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({
      url: absoluteUrl(`/categoria/${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products
      .filter((p) => !hide || p.available)
      .map((p) => ({
        url: absoluteUrl(`/producto/${p.slug}`),
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        ...(p.image ? { images: [p.image] } : {}),
      })),
    ...pages.map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...POLICY_LINKS.filter((p) => settings.policies[p.key]).map((p) => ({
      url: absoluteUrl(`/politicas/${p.slug}`),
      lastModified: settings.updated_at,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
    { url: absoluteUrl("/arrepentimiento"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
