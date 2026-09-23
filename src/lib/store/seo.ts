import type { Metadata } from "next";

import { storeUrl, type StoreUrlTarget } from "@/lib/tenant/urls";

/**
 * SEO del storefront (P0-01 / P0-03): metadata con OG/Twitter y JSON-LD.
 * Puro (sin I/O): las páginas le pasan los datos ya leídos.
 *
 * Multi-tienda: toda URL absoluta sale de `storeUrl(store, path)` (dominio
 * propio > subdominio > `/s/<slug>` en la plataforma), así el canonical, OG y
 * JSON-LD apuntan a la URL pública de ESA tienda.
 */

/** Tienda para armar URLs absolutas (`tenant.store` sirve). */
export type SeoStore = StoreUrlTarget;

/** URL absoluta de un path de la tienda ("/producto/x" → "https://x.ecommy.app/producto/x"). */
export function absoluteUrl(store: SeoStore, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return storeUrl(store, path.startsWith("/") ? path : `/${path}`);
}

export interface BuildMetadataInput {
  /** Tienda (para canonical/OG absolutos). */
  store: SeoStore;
  title: string;
  description?: string | null;
  /** Path canónico ("/producto/mate"). */
  path: string;
  image?: string | null;
  imageAlt?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
  siteName: string;
  /** Si es true, el título va sin la plantilla "… · Tienda". */
  absoluteTitle?: boolean;
}

function clip(text: string | null | undefined, max: number): string | undefined {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const description = clip(input.description, 160);
  const title = clip(input.title, 70) ?? input.siteName;
  const images = input.image ? [{ url: absoluteUrl(input.store, input.image), alt: input.imageAlt ?? title }] : undefined;
  return {
    title: input.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: absoluteUrl(input.store, input.path) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(input.store, input.path),
      siteName: input.siteName,
      locale: "es_AR",
      type: input.type ?? "website",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
    robots: input.noindex ? { index: false, follow: false } : undefined,
  };
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

export type JsonLd = Record<string, unknown>;

/** Serializa para `<script type="application/ld+json">` sin permitir cerrar el tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface ProductJsonLdInput {
  store: SeoStore;
  name: string;
  slug: string;
  description?: string | null;
  images: string[];
  sku?: string | null;
  brand?: string | null;
  /** Precio final (con promo) de la variante mostrada. */
  price: number;
  /** Si hay variantes con distintos precios. */
  lowPrice?: number;
  highPrice?: number;
  currency: string;
  available: boolean;
  specs?: { label: string; value: string }[];
  sellerName: string;
  /** Fin de la promo vigente, si tiene. */
  priceValidUntil?: string | null;
}

export function productJsonLd(p: ProductJsonLdInput): JsonLd {
  const url = absoluteUrl(p.store, `/producto/${p.slug}`);
  const availability = p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const offers: JsonLd =
    p.lowPrice !== undefined && p.highPrice !== undefined && p.lowPrice !== p.highPrice
      ? {
          "@type": "AggregateOffer",
          priceCurrency: p.currency,
          lowPrice: p.lowPrice,
          highPrice: p.highPrice,
          availability,
          url,
        }
      : {
          "@type": "Offer",
          priceCurrency: p.currency,
          price: p.price,
          availability,
          itemCondition: "https://schema.org/NewCondition",
          url,
          seller: { "@type": "Organization", name: p.sellerName },
          ...(p.priceValidUntil ? { priceValidUntil: p.priceValidUntil.slice(0, 10) } : {}),
        };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url,
    ...(p.description ? { description: clip(p.description, 5000) } : {}),
    ...(p.images.length ? { image: p.images.map((img) => absoluteUrl(p.store, img)) } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.specs?.length
      ? { additionalProperty: p.specs.map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.value })) }
      : {}),
    offers,
  };
}

export function breadcrumbJsonLd(store: SeoStore, items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(store, item.path),
    })),
  };
}

export interface OrganizationInput {
  store: SeoStore;
  name: string;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  social?: Partial<Record<string, string>>;
}

export function organizationJsonLd(o: OrganizationInput): JsonLd {
  const sameAs = Object.values(o.social ?? {}).filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: o.name,
    url: absoluteUrl(o.store, "/"),
    ...(o.logoUrl ? { logo: absoluteUrl(o.store, o.logoUrl) } : {}),
    ...(o.email ? { email: o.email } : {}),
    ...(o.phone ? { telephone: o.phone } : {}),
    ...(o.address ? { address: o.address } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd(store: SeoStore, name: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: absoluteUrl(store, "/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl(store, "/productos")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
