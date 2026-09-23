import type { MetadataRoute } from "next";

import { LEGAL_UPDATED_AT } from "@/components/platform/site";
import { HELP_ARTICLES } from "@/content/ayuda";
import { GUIDES } from "@/content/guias";
import { platformOrigin } from "@/lib/tenant/urls";

/**
 * Sitemap de la PLATAFORMA (landing, planes, contacto, legales, centro de
 * ayuda y guías, con la fecha de cada artículo). Cada tienda publica el suyo
 * en `s/[store]/sitemap.ts` (`/sitemap.xml` de su subdominio/dominio, o
 * `/s/<slug>/sitemap.xml` en modo fallback).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = platformOrigin();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/planes`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/contacto`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/terminos`, lastModified: LEGAL_UPDATED_AT, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/privacidad`, lastModified: LEGAL_UPDATED_AT, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/guias`, lastModified: latest(GUIDES), changeFrequency: "monthly", priority: 0.7 },
    ...GUIDES.map((g) => ({ url: `${origin}/guias/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${origin}/ayuda`, lastModified: latest(HELP_ARTICLES), changeFrequency: "monthly", priority: 0.5 },
    ...HELP_ARTICLES.map((a) => ({ url: `${origin}/ayuda/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}

/** Fecha más reciente de una lista de artículos (ISO sin hora). */
function latest(items: readonly { updatedAt: string }[]): string | undefined {
  return items.reduce<string | undefined>((max, i) => (!max || i.updatedAt > max ? i.updatedAt : max), undefined);
}
