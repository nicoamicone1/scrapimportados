import type { MetadataRoute } from "next";

import { platformOrigin } from "@/lib/tenant/urls";

/**
 * Sitemap de la PLATAFORMA (landing y planes). Cada tienda publica el suyo
 * en `s/[store]/sitemap.ts` (`/sitemap.xml` de su subdominio/dominio, o
 * `/s/<slug>/sitemap.xml` en modo fallback).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = platformOrigin();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/planes`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
