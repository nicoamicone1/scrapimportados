import type { Metadata } from "next";
import Link from "next/link";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { JsonLd } from "@/components/store/JsonLd";
import { ProductCard } from "@/components/store/ProductCard";
import { resolveBlockData } from "@/lib/blocks/resolve";
import { buildCategoryTree, listCategories } from "@/lib/store/categories";
import { getStoreDisplay } from "@/lib/store/display";
import { getPublishedPage } from "@/lib/store/pages";
import { listProducts } from "@/lib/store/products";
import { buildMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/store/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [page, { settings }] = await Promise.all([getPublishedPage("home"), getStoreDisplay()]);
  return buildMetadata({
    title: page?.seo.title || settings.seo.title || settings.name,
    description: page?.seo.description || settings.seo.description || settings.tagline,
    path: "/",
    image: page?.seo.og_image_url || settings.seo.og_image_url || null,
    siteName: settings.name,
    absoluteTitle: true,
  });
}

/** Home = página del builder con slug "home"; si no está publicada, novedades + categorías. */
export default async function HomePage() {
  const [page, display] = await Promise.all([getPublishedPage("home"), getStoreDisplay()]);
  const { settings, card } = display;

  const jsonLd = (
    <JsonLd
      data={[
        organizationJsonLd({
          name: settings.legal.razon_social || settings.name,
          logoUrl: settings.logo_url,
          email: settings.contact_email,
          phone: settings.contact_phone || (settings.whatsapp_phone ? `+${settings.whatsapp_phone}` : null),
          address: settings.address,
          social: settings.social,
        }),
        websiteJsonLd(settings.name),
      ]}
    />
  );

  const cardProps = {
    transferLabel: card.transferLabel,
    net: card.net,
    whatsappPhone: card.whatsappPhone,
  };

  if (page && page.blocks.some((b) => !b.style.hidden)) {
    const data = await resolveBlockData(page.blocks, display.promotions);
    const visible = page.blocks.filter((b) => !b.style.hidden);
    // El hero (primer bloque) o un heading nivel 1 ya ponen el h1; si no, uno oculto.
    const hasH1 = (visible[0]?.type === "hero") || visible.some((b) => b.type === "heading" && b.settings.level === 1);
    return (
      <>
        {jsonLd}
        {hasH1 ? null : <h1 className="sr-only">{settings.name}</h1>}
        <BlockRenderer
          blocks={page.blocks}
          data={data}
          promotions={display.promotions}
          theme={settings.theme}
          transferPercent={card.transferPercent}
          cardProps={cardProps}
          timezone={settings.timezone}
        />
      </>
    );
  }

  // Fallback: la home del builder no está publicada.
  const [latest, categories] = await Promise.all([
    listProducts({ sort: "nuevos", perPage: 10, outOfStock: settings.catalog.out_of_stock_display }),
    listCategories(),
  ]);
  const roots = buildCategoryTree(categories).slice(0, 12);

  return (
    <>
      {jsonLd}
      <section className="store-container pt-[var(--space-section-md)]">
        <h1 className="h-page max-w-[22ch]">{settings.name}</h1>
        {settings.tagline ? <p className="mt-2 max-w-[60ch] text-fg-muted">{settings.tagline}</p> : null}
        <Link href="/productos" className="btn btn-primary mt-6">
          Ver todos los productos
        </Link>
      </section>

      {latest.items.length ? (
        <section className="store-container pt-[var(--space-section-md)]" aria-labelledby="home-latest">
          <div className="mb-[calc(var(--gap-grid)*0.75+8px)] flex items-baseline justify-between gap-4">
            <h2 id="home-latest" className="h-section">
              Lo más nuevo
            </h2>
            <Link href="/productos" className="link-quiet text-sm">
              Ver todo
            </Link>
          </div>
          <div className="snap-row">
            {latest.items.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                promotions={card.promotions}
                cards={card.cards}
                transferPercent={card.transferPercent}
                {...cardProps}
                priority={i < 4}
                sizes="(min-width: 1024px) 20vw, 45vw"
              />
            ))}
          </div>
        </section>
      ) : null}

      {roots.length ? (
        <section className="store-container pt-[var(--space-section-md)]" aria-labelledby="home-cats">
          <h2 id="home-cats" className="h-section mb-4">
            Categorías
          </h2>
          <ul className="flex flex-wrap gap-2">
            {roots.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`} className="chip">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
