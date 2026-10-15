import type { PageFaqItem } from "./content";

/*
 * Datos estructurados de las páginas de captación: las mismas preguntas que
 * muestra el acordeón (FAQPage) y la ubicación (BreadcrumbList). Puro.
 */

export interface Crumb {
  label: string;
  /** Ruta relativa ("/", "/alternativa-a-tiendanube"). */
  href: string;
}

export function breadcrumbJsonLd(origin: string, crumbs: readonly Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: `${origin}${c.href === "/" ? "/" : c.href}`,
    })),
  };
}

export function faqJsonLd(origin: string, path: string, items: readonly PageFaqItem[]) {
  return {
    "@type": "FAQPage",
    "@id": `${origin}${path}#preguntas`,
    inLanguage: "es-AR",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** WebPage + BreadcrumbList + FAQPage en un solo `@graph`. */
export function landingPageJsonLd({
  origin,
  path,
  title,
  description,
  crumbs,
  faq,
}: {
  origin: string;
  path: string;
  title: string;
  description: string;
  crumbs: readonly Crumb[];
  faq: readonly PageFaqItem[];
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${origin}${path}`,
        url: `${origin}${path}`,
        name: title,
        description,
        inLanguage: "es-AR",
        isPartOf: { "@type": "WebSite", url: `${origin}/` },
      },
      breadcrumbJsonLd(origin, crumbs),
      faqJsonLd(origin, path, faq),
    ],
  };
}
