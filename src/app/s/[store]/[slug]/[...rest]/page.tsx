import { notFound } from "next/navigation";

import { requireStore } from "@/lib/store/context";
import { redirectIfMoved } from "@/lib/store/redirects";

/**
 * Catch-all de rutas de varios segmentos que no existen (ej. URLs de la
 * tienda anterior: /product/remera-negra/): prueba una redirección 301
 * cargada en `redirects` y, si no hay, 404 del storefront.
 */
export default async function LegacyPath({ params }: PageProps<"/s/[store]/[slug]/[...rest]">) {
  const { store, basePath } = await requireStore(params);
  const { slug, rest } = await params;
  await redirectIfMoved(store.id, `/${[slug, ...rest].join("/")}`, basePath);
  notFound();
}
