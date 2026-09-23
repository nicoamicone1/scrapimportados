import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleDoc } from "@/components/platform/ArticleDoc";
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
            <aside aria-labelledby="cta-t" className="mt-14 rounded-adm border border-adm-border bg-adm-surface p-5 sm:p-6">
              <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">{APP_NAME}</p>
              <h2 id="cta-t" className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
                {guide.cta.title}
              </h2>
              <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-adm-fg-muted">{guide.cta.text}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/registro"
                  className="inline-flex h-10 items-center rounded-adm bg-adm-accent px-4 text-sm font-medium text-adm-accent-fg transition-colors hover:bg-adm-accent-hover"
                >
                  Crear tu tienda gratis
                </Link>
                <Link href="/planes" className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
                  Ver planes
                </Link>
              </div>
              <p className="mt-4 text-[13px] text-adm-fg-muted">14 días de Pro gratis, sin tarjeta. Sin comisión por venta.</p>
            </aside>

            {others.length ? (
              <nav aria-labelledby="otras-t" className="mt-12">
                <h2 id="otras-t" className="text-[13px] font-medium text-adm-fg-muted">
                  Otras guías
                </h2>
                <ul className="mt-2 border-b border-adm-border">
                  {others.map((g) => (
                    <li key={g.slug} className="border-t border-adm-border py-3">
                      <Link href={`/guias/${g.slug}`} className="text-[15px] font-medium text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline">
                        {g.title}
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
