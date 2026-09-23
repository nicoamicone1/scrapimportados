import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView } from "@/components/store/CatalogView";
import { JsonLd } from "@/components/store/JsonLd";
import { getCategoryBySlug, listCategories } from "@/lib/store/categories";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { redirectIfMoved } from "@/lib/store/redirects";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/store/seo";

type Props = PageProps<"/s/[store]/categoria/[slug]">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const [{ slug }, sp, { settings }] = await Promise.all([params, searchParams, getStoreDisplay(store.id)]);
  const category = await getCategoryBySlug(store.id, slug);
  if (!category) return { title: "Categoría no encontrada", robots: { index: false } };
  const filtered = Object.keys(sp).some((k) => k !== "pagina" && k !== "page");
  return buildMetadata({
    store,
    title: category.seo.title || category.name,
    description: category.seo.description || category.description || `${category.name} en ${settings.name}.`,
    path: `/categoria/${category.slug}`,
    image: category.imageUrl,
    siteName: settings.name,
    noindex: filtered,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { store, basePath } = await requireStore(params);
  const [{ slug }, sp, display] = await Promise.all([params, searchParams, getStoreDisplay(store.id)]);
  const category = await getCategoryBySlug(store.id, slug);
  if (!category) {
    await redirectIfMoved(store.id, `/categoria/${slug}`, basePath);
    notFound();
  }

  const categories = await listCategories(store.id);
  const chain = [category];
  let parent = category.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
  while (parent && chain.length < 6) {
    chain.unshift(parent);
    parent = parent.parentId ? categories.find((c) => c.id === parent!.parentId) : undefined;
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(store, [
          { name: "Inicio", path: "/" },
          { name: "Productos", path: "/productos" },
          ...chain.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
        ])}
      />
      <CatalogView
        basePath={`/categoria/${category.slug}`}
        store={store}
        linkBase={basePath}
        searchParams={sp}
        display={display}
        category={category}
      />
    </>
  );
}
