import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/admin/builder/PageEditor";
import { renderBlockPreviews } from "@/components/admin/builder/render-preview";
import type { LinkSuggestion } from "@/components/admin/builder/fields";
import { getAdminPage, isUuidLike, listCategoryOptions, listPageOptions, listProductTags } from "@/lib/admin/pages";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/store/settings";

export async function generateMetadata({ params }: PageProps<"/admin/paginas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const page = isUuidLike(id) ? await getAdminPage(id) : null;
  return { title: page ? (page.type === "home" ? "Editar portada" : `Editar «${page.title}»`) : "Página" };
}

const STORE_ROUTES: LinkSuggestion[] = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Todos los productos" },
  { href: "/carrito", label: "Carrito" },
  { href: "/arrepentimiento", label: "Botón de arrepentimiento" },
];

export default async function EditPagePage({ params }: PageProps<"/admin/paginas/[id]">) {
  const { id } = await params;
  if (!isUuidLike(id)) notFound();
  const ctx = await requireAdmin();
  const [page, settings, categories, pages, tags] = await Promise.all([
    getAdminPage(id),
    getSettings(),
    listCategoryOptions(ctx),
    listPageOptions(ctx),
    listProductTags(ctx),
  ]);
  if (!page) notFound();

  const startBlocks = page.draft?.blocks ?? page.blocks;
  const initialNodes = await renderBlockPreviews(startBlocks, "desktop");

  const links: LinkSuggestion[] = [
    ...STORE_ROUTES,
    ...categories.map((c) => ({ href: `/categoria/${c.slug}`, label: `Categoría: ${c.path}` })),
    ...pages.filter((p) => p.slug !== "home").map((p) => ({ href: `/${p.slug}`, label: `Página: ${p.title}` })),
  ];

  return (
    <PageEditor
      page={page}
      theme={settings.theme}
      options={{ categories, tags, links, timezone: settings.timezone }}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      storeName={settings.name}
      initialNodes={initialNodes}
    />
  );
}
