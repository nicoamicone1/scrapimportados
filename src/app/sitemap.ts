import type { MetadataRoute } from "next";

import { LEGAL_UPDATED_AT } from "@/components/platform/site";
import { platformOrigin } from "@/lib/tenant/urls";

/**
 * Sitemap de la PLATAFORMA (landing, planes, contacto y legales). Cada tienda publica el suyo
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
  ];
}
