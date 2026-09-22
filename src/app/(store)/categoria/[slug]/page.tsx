import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView } from "@/components/store/CatalogView";
import { JsonLd } from "@/components/store/JsonLd";
import { getCategoryBySlug, listCategories } from "@/lib/store/categories";
import { getStoreDisplay } from "@/lib/store/display";
import { redirectIfMoved } from "@/lib/store/redirects";
import { breadcrumbJsonLd, buildMetadata } from "@/lib/store/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const [{ slug }, sp, { settings }] = await Promise.all([params, searchParams, getStoreDisplay()]);
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Categoría no encontrada", robots: { index: false } };
  const filtered = Object.keys(sp).some((k) => k !== "pagina" && k !== "page");
  return buildMetadata({
    title: category.seo.title || category.name,
    description: category.seo.description || category.description || `${category.name} en ${settings.name}.`,
    path: `/categoria/${category.slug}`,
    image: category.imageUrl,
    siteName: settings.name,
    noindex: filtered,
  });
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categoria/[slug]">) {
  const [{ slug }, sp, display] = await Promise.all([params, searchParams, getStoreDisplay()]);
  const category = await getCategoryBySlug(slug);
  if (!category) {
    await redirectIfMoved(`/categoria/${slug}`);
    notFound();
  }

  const categories = await listCategories();
  const chain = [category];
  let parent = category.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
  while (parent && chain.length < 6) {
    chain.unshift(parent);
    parent = parent.parentId ? categories.find((c) => c.id === parent!.parentId) : undefined;
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Productos", path: "/productos" },
          ...chain.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
        ])}
      />
      <CatalogView basePath={`/categoria/${category.slug}`} searchParams={sp} display={display} category={category} />
    </>
  );
}
