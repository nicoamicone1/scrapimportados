import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/admin/builder/PageEditor";
import { renderBlockPreviews } from "@/components/admin/builder/render-preview";
import type { LinkSuggestion } from "@/components/admin/builder/fields";
import { getAdminPage, isUuidLike, listCategoryOptions, listPageOptions, listProductTags } from "@/lib/admin/pages";
import { requireAdmin } from "@/lib/auth";
import { getStoreDisplay } from "@/lib/store/display";
import { getSettings } from "@/lib/store/settings";
import { storeUrl } from "@/lib/tenant/urls";

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
  const [page, settings, categories, pages, tags, display] = await Promise.all([
    getAdminPage(id),
    getSettings(ctx.store.id),
    listCategoryOptions(ctx),
    listPageOptions(ctx),
    listProductTags(ctx),
    getStoreDisplay(ctx.store.id),
  ]);
  if (!page) notFound();

  const startBlocks = page.draft?.blocks ?? page.blocks;
  const initialNodes = await renderBlockPreviews(ctx.store.id, startBlocks, "desktop");

  const links: LinkSuggestion[] = [
    ...STORE_ROUTES,
    ...(ctx.modules.includes("print3d") ? [{ href: "/impresion-3d", label: "Cotizador 3D" }] : []),
    ...categories.map((c) => ({ href: `/categoria/${c.slug}`, label: `Categoría: ${c.path}` })),
    ...pages.filter((p) => p.slug !== "home").map((p) => ({ href: `/${p.slug}`, label: `Página: ${p.title}` })),
  ];

  return (
    <PageEditor
      page={page}
      theme={settings.theme}
      options={{
        categories,
        tags,
        links,
        timezone: settings.timezone,
        modules: ctx.modules,
        starter: { transferDiscount: display.card.transferPercent, whatsapp: Boolean(display.card.whatsappPhone) },
      }}
      siteUrl={storeUrl(ctx.store)}
      storeName={settings.name}
      initialNodes={initialNodes}
    />
  );
}
