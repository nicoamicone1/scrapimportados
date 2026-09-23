import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleDoc } from "@/components/platform/ArticleDoc";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { formatLegalDate } from "@/components/platform/site";
import { getHelpArticle, HELP_ARTICLES, helpSectionTitle, relatedHelp } from "@/content/ayuda";
import { extractHeadings } from "@/content/text";
import { APP_NAME } from "@/lib/version";

/*
 * Estática: no lee la sesión (el header muestra "Ingresar"; con sesión, /login
 * lleva directo a /app). Se sirve desde la CDN sin pasar por Supabase. Se
 * generan todas en el build; un slug que no existe da 404.
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
              className="inline-flex h-9 items-center gap-1.5 rounded-adm border border-adm-input-border bg-adm-surface px-3 text-[13px] font-medium text-adm-fg transition-colors hover:bg-adm-hover"
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
            {related.length ? (
              <nav aria-labelledby="relacionados-t" className="mt-14">
                <h2 id="relacionados-t" className="text-[13px] font-medium text-adm-fg-muted">
                  Relacionados
                </h2>
                <ul className="mt-2 border-b border-adm-border">
                  {related.map((r) => (
                    <li key={r.slug} className="border-t border-adm-border py-3">
                      <Link href={`/ayuda/${r.slug}`} className="text-[15px] font-medium text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline">
                        {r.title}
                      </Link>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-adm-fg-muted">{r.description}</p>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <p className="mt-10 rounded-adm border border-adm-border bg-adm-surface px-4 py-4 text-[14px] leading-relaxed">
              <span className="font-medium">¿No encontraste lo que buscabas?</span>{" "}
              <Link href="/contacto" className="text-adm-accent underline underline-offset-2">
                Escribinos
              </Link>{" "}
              con la dirección de tu tienda y qué querés hacer, o{" "}
              <Link href="/ayuda" className="text-adm-accent underline underline-offset-2">
                volvé al centro de ayuda
              </Link>
              .
            </p>
          </>
        }
      >
        {article.body}
      </ArticleDoc>
    </PlatformPage>
  );
}
