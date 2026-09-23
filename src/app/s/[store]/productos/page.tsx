import type { Metadata } from "next";

import { CatalogView } from "@/components/store/CatalogView";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { buildMetadata } from "@/lib/store/seo";

type Props = PageProps<"/s/[store]/productos">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const [{ settings }, sp] = await Promise.all([getStoreDisplay(store.id), searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filtered = Object.keys(sp).some((k) => k !== "pagina" && k !== "page");
  return buildMetadata({
    store,
    title: q ? `Resultados para «${q}»` : "Productos",
    description: `Catálogo completo de ${settings.name}.`,
    path: "/productos",
    siteName: settings.name,
    // Búsquedas y combinaciones de filtros no se indexan (contenido duplicado).
    noindex: filtered,
  });
}

/** Listado con filtros facetados, búsqueda (?q=), orden y paginación. */
export default async function ProductsPage({ params, searchParams }: Props) {
  const { store, basePath } = await requireStore(params);
  const [display, sp] = await Promise.all([getStoreDisplay(store.id), searchParams]);
  return <CatalogView basePath="/productos" store={store} linkBase={basePath} searchParams={sp} display={display} />;
}
