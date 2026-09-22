import type { Metadata } from "next";

import { CatalogView } from "@/components/store/CatalogView";
import { getStoreDisplay } from "@/lib/store/display";
import { buildMetadata } from "@/lib/store/seo";

export async function generateMetadata({ searchParams }: PageProps<"/productos">): Promise<Metadata> {
  const [{ settings }, params] = await Promise.all([getStoreDisplay(), searchParams]);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filtered = Object.keys(params).some((k) => k !== "pagina" && k !== "page");
  return buildMetadata({
    title: q ? `Resultados para «${q}»` : "Productos",
    description: `Catálogo completo de ${settings.name}.`,
    path: "/productos",
    siteName: settings.name,
    // Búsquedas y combinaciones de filtros no se indexan (contenido duplicado).
    noindex: filtered,
  });
}

/** Listado con filtros facetados, búsqueda (?q=), orden y paginación. */
export default async function ProductsPage({ searchParams }: PageProps<"/productos">) {
  const [display, params] = await Promise.all([getStoreDisplay(), searchParams]);
  return <CatalogView basePath="/productos" searchParams={params} display={display} />;
}
