import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { resolveBlockData } from "@/lib/blocks/resolve";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { getPublishedPage } from "@/lib/store/pages";
import { redirectIfMoved } from "@/lib/store/redirects";
import { buildMetadata } from "@/lib/store/seo";

type Props = PageProps<"/s/[store]/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const [{ slug }, { settings }] = await Promise.all([params, getStoreDisplay(store.id)]);
  const page = slug === "home" ? null : await getPublishedPage(store.id, slug);
  if (!page) return { title: "Página no encontrada" };
  return buildMetadata({
    store,
    title: page.seo.title || page.title,
    description: page.seo.description || null,
    path: `/${page.slug}`,
    image: page.seo.og_image_url || null,
    siteName: settings.name,
  });
}

/** Páginas publicadas del builder (landings como /ciberlunes, legales, etc.). */
export default async function BuilderPage({ params }: Props) {
  const { store, basePath } = await requireStore(params);
  const [{ slug }, display] = await Promise.all([params, getStoreDisplay(store.id)]);
  // La home vive en "/", no en "/home".
  const page = slug === "home" ? null : await getPublishedPage(store.id, slug);
  if (!page) {
    await redirectIfMoved(store.id, `/${slug}`, basePath);
    notFound();
  }
  const { settings, card } = display;
  const data = await resolveBlockData(store.id, page.blocks, display.promotions);
  const visible = page.blocks.filter((b) => !b.style.hidden);
  const hasH1 = visible[0]?.type === "hero" || visible.some((b) => b.type === "heading" && b.settings.level === 1);

  return (
    <>
      {hasH1 ? null : <h1 className="sr-only">{page.title}</h1>}
      <BlockRenderer
        blocks={page.blocks}
        data={data}
        promotions={display.promotions}
        theme={settings.theme}
        transferPercent={card.transferPercent}
        cardProps={{ transferLabel: card.transferLabel, net: card.net, whatsappPhone: card.whatsappPhone, store }}
        timezone={settings.timezone}
      />
    </>
  );
}
