import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleDoc } from "@/components/platform/ArticleDoc";
import { CTA_ARROW, CTA_PRIMARY, DISPLAY } from "@/components/platform/brand";
import { cn } from "@/lib/cn";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { formatLegalDate } from "@/components/platform/site";
import { getHelpArticle, HELP_ARTICLES, helpSectionTitle, relatedHelp } from "@/content/ayuda";
import { extractHeadings } from "@/content/text";
import { APP_NAME } from "@/lib/version";

/*
 * Estática: no lee la sesión (el header muestra "Ingresar"; con sesión, /login
 * lleva directo a /app). Se sirve desde la CDN sin pasar por Supabase. Se
 * generan todas en el build; un slug que no existe da 404.
 *
 * Al final de cada artículo va la invitación a crear la tienda (a estas
 * páginas llega desde Google gente que todavía no tiene una). Como no se lee
 * la sesión, el mismo bloque le ofrece a quien ya tiene tienda el link al
 * panel que declara el artículo (`panel`), si lo tiene.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/ayuda/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) return { title: "Artículo no encontrado", robots: { index: false } };
  const url = `/ayuda/${article.slug}`;
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      siteName: APP_NAME,
      locale: "es_AR",
      type: "article",
      title: article.title,
      description: article.description,
      url,
      modifiedTime: article.updatedAt,
    },
  };
}

export default async function AyudaArticlePage({ params }: PageProps<"/ayuda/[slug]">) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();

  const section = helpSectionTitle(article.section);
  const related = relatedHelp(article);

  return (
    <PlatformPage signedIn={false}>
      <ArticleDoc
        breadcrumb={[
          { href: "/ayuda", label: "Ayuda" },
          { href: `/ayuda#${article.section}`, label: section },
        ]}
        title={article.title}
        lead={article.description}
        meta={
          <>
            <span>{section}</span>
            <span aria-hidden>·</span>
            <span>{article.readingMinutes} min de lectura</span>
            <span aria-hidden>·</span>
            <span>
              Actualizado el <time dateTime={article.updatedAt}>{formatLegalDate(article.updatedAt)}</time>
            </span>
          </>
        }
        actions={
          article.panel ? (
            <Link
              href={article.panel.href}
              target="_blank"
              rel="noopener"
              className="site-pill-secondary inline-flex h-11 items-center gap-2 rounded-full border-2 border-eco-ink px-5 text-[14px] font-semibold text-eco-ink transition-colors duration-[240ms] hover:bg-eco-ink hover:text-white"
            >
              Abrir {article.panel.label} en el panel
              <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </Link>
          ) : null
        }
        headings={extractHeadings(article.body)}
        after={
          <>
            <aside aria-labelledby="empezar-t" className="eco-bubble mt-14 bg-eco-durazno px-6 py-7 text-eco-ink [--eco-bubble-r:28px] sm:px-8">
              <h2 id="empezar-t" className={cn(DISPLAY, "text-[22px] leading-tight sm:text-[26px]")}>
                ¿Todavía no tenés tu tienda?
              </h2>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed">14 días de Pro gratis, sin tarjeta. Sin comisión por venta.</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/empezar" className={cn(CTA_PRIMARY, "h-auto min-h-12 max-w-full py-2 text-left leading-snug text-balance")}>
                  Cargamos tu catálogo y lo probás 14 días
                  <span className={cn(CTA_ARROW, "shrink-0")}>
                    <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                  </span>
                </Link>
                <Link href="/registro" className="inline-flex min-h-11 items-center text-[15px] font-semibold underline decoration-2 underline-offset-4">
                  o creala vos
                </Link>
              </div>
              {article.panel ? (
                <p className="mt-5 border-t border-eco-ink/15 pt-4 text-[14px]">
                  ¿Ya tenés tienda?{" "}
                  <Link href={article.panel.href} className="font-semibold underline decoration-2 underline-offset-4">
                    Abrí {article.panel.label} en el panel
                  </Link>
                  .
                </p>
              ) : null}
            </aside>

            {related.length ? (
              <nav aria-labelledby="relacionados-t" className="mt-16">
                <h2 id="relacionados-t" className={cn(DISPLAY, "text-[22px]")}>
                  Relacionados
                </h2>
                <ul className="mt-4 grid gap-3">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link href={`/ayuda/${r.slug}`} className="site-lift group flex items-center gap-4 border border-eco-line bg-adm-surface px-5 py-4">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] leading-snug font-semibold">{r.title}</span>
                          <span className="mt-1 block text-[14px] leading-relaxed text-adm-fg-muted">{r.description}</span>
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
            <div className="eco-bubble mt-12 bg-eco-ink px-6 py-6 text-[15px] leading-relaxed text-eco-mist [--eco-bubble-r:24px] sm:px-7">
              <p className={cn(DISPLAY, "text-[20px] text-white")}>¿No encontraste lo que buscabas?</p>
              <p className="mt-2">
                <Link href="/contacto" className="font-semibold text-eco-azul-light underline decoration-2 underline-offset-4">
                  Escribinos
                </Link>{" "}
                con la dirección de tu tienda y qué querés hacer, o{" "}
                <Link href="/ayuda" className="font-semibold text-eco-azul-light underline decoration-2 underline-offset-4">
                  volvé al centro de ayuda
                </Link>
                .
              </p>
            </div>
          </>
        }
      >
        {article.body}
      </ArticleDoc>
    </PlatformPage>
  );
}
