import type { Metadata } from "next";

import { APP_NAME } from "@/lib/version";

import type { PageMeta } from "./content";

/**
 * Metadata de una página de captación: título completo (sin el template del
 * layout), descripción, canonical y OpenGraph. Next reemplaza el objeto
 * `openGraph` entero, así que se repite lo del layout; la imagen sale del
 * `opengraph-image.tsx` de cada ruta.
 */
export function landingMetadata(meta: PageMeta): Metadata {
  return {
    title: { absolute: meta.title },
    description: meta.description,
    alternates: { canonical: meta.path },
    openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website", title: meta.title, description: meta.description, url: meta.path },
  };
}
