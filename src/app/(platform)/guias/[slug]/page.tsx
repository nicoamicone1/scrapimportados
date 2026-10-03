import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleDoc } from "@/components/platform/ArticleDoc";
import { CTA_ARROW, CTA_PRIMARY, DISPLAY, EYEBROW } from "@/components/platform/brand";
import { cn } from "@/lib/cn";

import { CornerArc } from "../../site-shapes";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { formatLegalDate } from "@/components/platform/site";
import { JsonLd } from "@/components/store/JsonLd";
import { getGuide, GUIDES } from "@/content/guias";
import { extractHeadings } from "@/content/text";
import { platformOrigin } from "@/lib/tenant/urls";
import { APP_NAME } from "@/lib/version";

/*
 * Estática: no lee la sesión (el header muestra "Ingresar"; con sesión, /login
 * lleva directo a /app). Se sirve desde la CDN sin pasar por Supabase. Se
 * generan todas en el build; un slug que no existe da 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guía no encontrada", robots: { index: false } };
  const url = `/guias/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: {
      siteName: APP_NAME,
      locale: "es_AR",
      type: "article",
      title: guide.title,
      description: guide.description,
      url,
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
    },
  };
}

export default async function GuiaPage({ params }: PageProps<"/guias/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const origin = platformOrigin();
  const others = GUIDES.filter((g) => g.slug !== guide.slug);
  const organization = { "@type": "Organization", "@id": `${origin}/#organization`, name: APP_NAME, url: `${origin}/` };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    inLanguage: "es-AR",
    mainEntityOfPage: `${origin}/guias/${guide.slug}`,
    author: organization,
    publisher: organization,
  };

  return (
    <PlatformPage signedIn={false}>
      <JsonLd data={jsonLd} />
      <ArticleDoc
        variant="guide"
        breadcrumb={[{ href: "/guias", label: "Guías" }]}
        title={guide.title}
        lead={guide.description}
        meta={
          <>
            <span>{guide.section}</span>
            <span aria-hidden>·</span>
            <span>
              Última actualización: <time dateTime={guide.updatedAt}>{formatLegalDate(guide.updatedAt)}</time>
            </span>
            <span aria-hidden>·</span>
            <span>{guide.readingMinutes} min de lectura</span>
          </>
        }
        headings={extractHeadings(guide.body)}
        after={
          <>
            <aside aria-labelledby="cta-t" className="eco-bubble relative mt-16 overflow-hidden bg-eco-durazno p-7 text-eco-ink [--eco-bubble-r:32px] sm:p-9">
              <CornerArc corner="tr" size={260} className="bg-eco-pomelo-soft" />
              <div className="relative">
                <p className={EYEBROW}>{APP_NAME}</p>
                <h2 id="cta-t" className={cn(DISPLAY, "mt-3 max-w-[20ch] text-[28px] leading-[1.04] sm:text-[34px]")}>
                  {guide.cta.title}
                </h2>
                <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed">{guide.cta.text}</p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link href="/registro" className={CTA_PRIMARY}>
                    Crear tu tienda gratis
                    <span className={CTA_ARROW}>
                      <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                  </Link>
                  <Link href="/planes" className="inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-2 underline-offset-4">
                    Ver planes
                  </Link>
                </div>
                <p className="mt-4 text-[13px]">14 días de Pro gratis, sin tarjeta. Sin comisión por venta.</p>
              </div>
            </aside>

            {others.length ? (
              <nav aria-labelledby="otras-t" className="mt-14">
                <h2 id="otras-t" className={cn(DISPLAY, "text-[22px]")}>
                  Otras guías
                </h2>
                <ul className="mt-4 grid gap-3">
                  {others.map((g) => (
                    <li key={g.slug}>
                      <Link href={`/guias/${g.slug}`} className="site-lift group flex items-center gap-4 border border-eco-line bg-adm-surface px-5 py-4">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold tracking-[0.06em] text-eco-pomelo-ink uppercase">{g.section}</span>
                          <span className="mt-1 block text-[16px] leading-snug font-semibold">{g.title}</span>
                        </span>
                        <span aria-hidden className="site-arrow flex size-9 shrink-0 items-center justify-center rounded-full bg-eco-niebla-2">
                          <ArrowRight className="size-4" strokeWidth={2} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </>
        }
      >
        {guide.body}
      </ArticleDoc>
    </PlatformPage>
  );
}
