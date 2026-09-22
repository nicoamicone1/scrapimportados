import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { JsonLd } from "@/components/store/JsonLd";
import { ProductCard } from "@/components/store/ProductCard";
import { DetailSection, ProductView } from "@/components/store/ProductView";
import { TrackEvent } from "@/components/store/Track";
import { FabProduct } from "@/components/store/WhatsAppFab";
import { getProfile, isAdminRole } from "@/lib/auth";
import { sanitizeHtml, stripHtml } from "@/lib/html";
import { formatMoney } from "@/lib/money";
import { applyPromotions, bestPaymentDiscount, resolveVatPercent } from "@/lib/pricing";
import { listCategories } from "@/lib/store/categories";
import { getStoreDisplay, type StoreDisplay } from "@/lib/store/display";
import { displayPrice, getProduct, getProductPreview, getRelated, type ProductDetail } from "@/lib/store/products";
import { redirectIfMoved } from "@/lib/store/redirects";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, productJsonLd } from "@/lib/store/seo";
import { buildProductMessage, waLink } from "@/lib/store/whatsapp";

type Props = PageProps<"/producto/[slug]">;

async function isAdmin(): Promise<boolean> {
  try {
    const profile = await getProfile();
    return Boolean(profile?.is_active && isAdminRole(profile.role));
  } catch {
    return false;
  }
}

/** Producto publicado o, con `?preview=1` y sesión de admin, cualquier estado (sin cache). */
async function loadProduct(slug: string, preview: boolean): Promise<{ product: ProductDetail | null; previewing: boolean }> {
  if (preview && (await isAdmin())) {
    const product = await getProductPreview(slug);
    return { product, previewing: Boolean(product && product.status !== "active") };
  }
  return { product: await getProduct(slug), previewing: false };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp, { settings, promotions }] = await Promise.all([params, searchParams, getStoreDisplay()]);
  const product = await getProduct(slug);
  if (!product) {
    return sp.preview ? { title: "Vista previa", robots: { index: false, follow: false } } : { title: "Producto no encontrado" };
  }
  const price = displayPrice(product, promotions);
  const plain = stripHtml(product.shortDescription || product.descriptionHtml || "");
  const description =
    product.seo.description ||
    [plain.slice(0, 120), `${price.from ? "Desde " : ""}${formatMoney(price.price)}`].filter(Boolean).join(" · ");
  return buildMetadata({
    title: product.seo.title || product.name,
    description,
    path: `/producto/${product.slug}`,
    image: product.seo.og_image_url || product.image?.url,
    imageAlt: product.name,
    siteName: settings.name,
    noindex: Boolean(sp.variant || sp.preview),
  });
}

function DeliveryNote({ display }: { display: StoreDisplay }) {
  const { zones, pickups } = display;
  if (!zones.length && !pickups.length) return null;
  const minCost = zones.length ? Math.min(...zones.map((z) => z.cost)) : null;
  const everywhere = zones.some((z) => z.type === "everywhere");
  const names = zones.filter((z) => z.type !== "everywhere").map((z) => z.name);
  return (
    <ul className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
      {zones.length ? (
        <li>
          <span className="font-medium">Te lo llevamos</span>
          <span className="text-fg-muted">
            {" · "}
            {everywhere ? "envíos a todo el país" : `envíos a ${names.slice(0, 4).join(", ")}${names.length > 4 ? " y más" : ""}`}
            {minCost !== null ? (minCost > 0 ? ` · desde ${formatMoney(minCost)}` : " · sin cargo") : ""}
          </span>
          {display.freeShippingThreshold ? (
            <span className="block text-fg-muted">
              Envío gratis desde {formatMoney(display.freeShippingThreshold)}
              {display.freeShippingPartial ? " en zonas seleccionadas" : ""}.
            </span>
          ) : null}
        </li>
      ) : null}
      {pickups.length ? (
        <li>
          <span className="font-medium">Retirás en el local</span>
          <span className="text-fg-muted"> · gratis</span>
          <span className="block text-fg-muted">{pickups.map((p) => p.address || p.name).join(" · ")}</span>
        </li>
      ) : null}
      <li className="text-fg-muted">El costo exacto de envío lo ves en el checkout.</li>
    </ul>
  );
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, sp, display] = await Promise.all([params, searchParams, getStoreDisplay()]);
  const preview = sp.preview === "1";
  const { product, previewing } = await loadProduct(slug, preview);
  if (!product) {
    await redirectIfMoved(`/producto/${slug}`);
    notFound();
  }

  const { settings, promotions, paymentMethods, card } = display;
  const theme = settings.theme;
  const url = absoluteUrl(`/producto/${product.slug}`);
  const variantParam = typeof sp.variant === "string" ? sp.variant : null;

  const [categories, related] = await Promise.all([listCategories(), previewing ? Promise.resolve([]) : getRelated(product, 8)]);

  // Breadcrumb: la primera categoría con su cadena de padres.
  const chain: { name: string; slug: string }[] = [];
  const first = product.categories[0];
  if (first) {
    let current = categories.find((c) => c.id === first.id);
    while (current && chain.length < 6) {
      chain.unshift({ name: current.name, slug: current.slug });
      current = current.parentId ? categories.find((c) => c.id === current!.parentId) : undefined;
    }
    if (!chain.length) chain.push({ name: first.name, slug: first.slug });
  }

  const price = displayPrice(product, promotions);
  const available = product.available;
  const finalPrices = product.variants.map(
    (v) => applyPromotions({ id: v.id, price: v.price, compareAtPrice: v.compareAtPrice }, { id: product.id, categoryIds: product.categoryIds }, promotions).price,
  );
  const promoEnds = price.promotion ? promotions.find((p) => p.id === price.promotion?.id)?.endsAt : null;
  const whatsappHref =
    card.whatsappPhone || settings.whatsapp_phone
      ? waLink(card.whatsappPhone || settings.whatsapp_phone, buildProductMessage(null, { name: product.name, url }))
      : null;
  const net = settings.tax.show_net_price ? { vat: resolveVatPercent(product.vatPercent, settings.tax.default_vat_percent), label: settings.tax.label } : null;
  const contain = theme.cards.imageRatio === "1:1" || theme.cards.imageRatio === "16:9";
  const description = product.descriptionHtml ? sanitizeHtml(product.descriptionHtml) : "";

  return (
    <>
      {previewing ? (
        <div className="bg-fg px-4 py-2 text-center text-sm text-bg" role="status">
          Vista previa: este producto no está publicado ({product.status === "draft" ? "borrador" : "archivado"}). Sólo lo ves vos.
        </div>
      ) : null}
      {!previewing ? (
        <>
          <JsonLd
            data={productJsonLd({
              name: product.name,
              slug: product.slug,
              description: stripHtml(product.shortDescription || product.descriptionHtml || "") || null,
              images: product.images.map((i) => i.url),
              sku: product.sku,
              brand: product.brand,
              price: price.price,
              lowPrice: Math.min(...finalPrices),
              highPrice: Math.max(...finalPrices),
              currency: settings.currency,
              available,
              specs: product.specs,
              sellerName: settings.name,
              priceValidUntil: promoEnds ?? null,
            })}
          />
          <JsonLd
            data={breadcrumbJsonLd([
              { name: "Inicio", path: "/" },
              ...chain.map((c) => ({ name: c.name, path: `/categoria/${c.slug}` })),
              { name: product.name, path: `/producto/${product.slug}` },
            ])}
          />
          <TrackEvent
            event="view_item"
            payload={{
              currency: settings.currency,
              value: price.price,
              items: [{ item_id: product.sku || product.id, item_name: product.name, item_brand: product.brand, price: price.price, quantity: 1 }],
            }}
          />
          <FabProduct name={product.name} url={url} />
        </>
      ) : null}

      <div className="store-container py-[var(--space-section-sm)]">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { name: "Inicio", href: "/" },
              ...(chain.length ? chain.map((c) => ({ name: c.name, href: `/categoria/${c.slug}` })) : [{ name: "Productos", href: "/productos" }]),
              { name: product.name },
            ]}
          />
        </div>

        <ProductView
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            categoryIds: product.categoryIds,
            vatPercent: product.vatPercent,
            options: product.options,
            variants: product.variants,
            images: product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
          }}
          promotions={promotions}
          initialVariantId={variantParam}
          transferPercent={bestPaymentDiscount(paymentMethods)?.discountPercent ?? 0}
          transferLabel={card.transferLabel}
          net={net}
          lowStockThreshold={settings.low_stock_threshold}
          paymentMethods={paymentMethods.map((m) => ({ name: m.name, discountPercent: m.discountPercent, type: m.type }))}
          whatsappHref={whatsappHref}
          contain={contain}
        >
          <DeliveryNote display={display} />
          {product.shortDescription ? <p className="mt-6 text-fg-muted">{product.shortDescription}</p> : null}
          {description ? (
            <DetailSection title="Descripción">
              <div className="prose-store text-sm" dangerouslySetInnerHTML={{ __html: description }} />
            </DetailSection>
          ) : null}
          {product.specs.length ? (
            <DetailSection title="Ficha técnica">
              <table className="spec-table">
                <tbody>
                  {product.specs.map((s, i) => (
                    <tr key={`${s.label}-${i}`}>
                      <th scope="row">{s.label}</th>
                      <td>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DetailSection>
          ) : null}
          <p className="mt-6 text-xs text-fg-muted">
            ¿Te arrepentiste de una compra? Tenés 10 días corridos:{" "}
            <Link href="/arrepentimiento" className="link">
              botón de arrepentimiento
            </Link>
            .
          </p>
        </ProductView>
      </div>

      {related.length ? (
        <section className="store-container pt-[var(--space-section-md)]" aria-labelledby="relacionados">
          <h2 id="relacionados" className="h-section mb-[calc(var(--gap-grid)*0.75+8px)]">
            También te puede interesar
          </h2>
          <div className="snap-row">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                promotions={card.promotions}
                cards={card.cards}
                transferPercent={card.transferPercent}
                transferLabel={card.transferLabel}
                net={card.net}
                whatsappPhone={card.whatsappPhone}
                sizes="(min-width: 1024px) 20vw, 45vw"
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
