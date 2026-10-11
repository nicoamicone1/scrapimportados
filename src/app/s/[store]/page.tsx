import type { Metadata } from "next";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { JsonLd } from "@/components/store/JsonLd";
import { ProductCard } from "@/components/store/ProductCard";
import { StoreLink } from "@/components/store/StoreLink";
import { previewHomeBlocks } from "@/lib/blocks/preview";
import { bestPaymentDiscount } from "@/lib/pricing";
import { resolveBlockData } from "@/lib/blocks/resolve";
import { buildCategoryTree, listCategories } from "@/lib/store/categories";
import { lunaHomeBlocks, withLunaCategoryImages } from "@/lib/showcase/luna";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay, isLunaDevPreview } from "@/lib/store/display";
import { getPublishedPage } from "@/lib/store/pages";
import { listProducts } from "@/lib/store/products";
import { buildMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/store/seo";

type Props = PageProps<"/s/[store]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store } = await requireStore(params);
  const [page, { settings }] = await Promise.all([getPublishedPage(store.id, "home"), getStoreDisplay(store.id)]);
  return buildMetadata({
    store,
    title: page?.seo.title || settings.seo.title || settings.name,
    description: page?.seo.description || settings.seo.description || settings.tagline,
    path: "/",
    image: page?.seo.og_image_url || settings.seo.og_image_url || null,
    siteName: settings.name,
    absoluteTitle: true,
  });
}

/** Home = página del builder con slug "home"; si no está publicada, novedades + categorías. */
export default async function HomePage({ params }: Props) {
  const { store } = await requireStore(params);
  const [page, display] = await Promise.all([getPublishedPage(store.id, "home"), getStoreDisplay(store.id)]);
  const { settings, card } = display;

  const jsonLd = (
    <JsonLd
      data={[
        organizationJsonLd({
          store,
          name: settings.legal.razon_social || settings.name,
          logoUrl: settings.logo_url,
          email: settings.contact_email,
          phone: settings.contact_phone || (settings.whatsapp_phone ? `+${settings.whatsapp_phone}` : null),
          address: settings.address,
          social: settings.social,
        }),
        websiteJsonLd(store, settings.name),
      ]}
    />
  );

  const cardProps = {
    transferLabel: card.transferLabel,
    freeInstallments: card.freeInstallments,
    net: card.net,
    whatsappPhone: card.whatsappPhone,
    store,
  };

  // `?estilo=<preset>` en la demo: la portada de fábrica de ese preset (S2, sólo lectura).
  const preview = await previewHomeBlocks({
    theme: settings.theme,
    storeName: settings.name,
    transferDiscount: card.transferPercent,
    whatsapp: Boolean(card.whatsappPhone),
    saved: page?.blocks,
  });
  // Sólo en desarrollo, con la cookie `ecommy_dev_theme=luna` en la demo: la portada que deja el seed (docs/DEMO-ROPA.md).
  const luna = !preview && (await isLunaDevPreview());
  const lunaBlocks = luna
    ? lunaHomeBlocks({
        now: new Date(),
        // Como el seed: el descuento del medio de pago (aunque el tema no lo muestre en las tarjetas).
        transferDiscount: bestPaymentDiscount(display.paymentMethods)?.discountPercent ?? 0,
        whatsapp: Boolean(card.whatsappPhone),
        // Como el seed: el envío gratis más bajo de las zonas (sin depender de la barra de envío gratis).
        freeShippingFrom: Math.min(...display.zones.map((z) => (z.freeOver && z.freeOver > 0 ? z.freeOver : Infinity))),
        timeZone: settings.timezone,
      })
    : null;
  const blocks = preview ?? lunaBlocks ?? page?.blocks ?? [];

  if (blocks.some((b) => !b.style.hidden)) {
    const resolved = await resolveBlockData(store.id, blocks, display.promotions);
    const data = luna ? { ...resolved, categories: withLunaCategoryImages(resolved.categories) } : resolved;
    const visible = blocks.filter((b) => !b.style.hidden);
    // El hero (primer bloque) o un heading nivel 1 ya ponen el h1; si no, uno oculto.
    const hasH1 = (visible[0]?.type === "hero") || visible.some((b) => b.type === "heading" && b.settings.level === 1);
    return (
      <>
        {jsonLd}
        {hasH1 ? null : <h1 className="sr-only">{settings.name}</h1>}
        <BlockRenderer
          blocks={blocks}
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
    listProducts(store.id, { sort: "nuevos", perPage: 10, outOfStock: settings.catalog.out_of_stock_display }),
    listCategories(store.id),
  ]);
  const roots = buildCategoryTree(categories).slice(0, 12);

  return (
    <>
      {jsonLd}
      <section className="store-container pt-[var(--space-section-md)]">
        <h1 className="h-page max-w-[22ch]">{settings.name}</h1>
        {settings.tagline ? <p className="mt-2 max-w-[60ch] text-fg-muted">{settings.tagline}</p> : null}
        <StoreLink href="/productos" className="btn btn-primary mt-6">
          Ver todos los productos
        </StoreLink>
      </section>

      {latest.items.length ? (
        <section className="store-container pt-[var(--space-section-md)]" aria-labelledby="home-latest">
          <div className="mb-[calc(var(--gap-grid)*0.75+8px)] flex items-baseline justify-between gap-4">
            <h2 id="home-latest" className="h-section">
              Lo más nuevo
            </h2>
            <StoreLink href="/productos" className="link-quiet text-sm">
              Ver todo
            </StoreLink>
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
                <StoreLink href={`/categoria/${c.slug}`} className="chip">
                  {c.name}
                </StoreLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
