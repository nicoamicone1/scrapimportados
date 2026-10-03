import { getHelpArticle, HELP_ARTICLES, helpSectionTitle } from "@/content/ayuda";
import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "../../og-card";

/*
 * Imagen para compartir de cada artículo de ayuda, con su título (el
 * artículo define su propio `openGraph` y sin este archivo se perdería).
 * `generateStaticParams`: se genera en el build, una por artículo.
 */

export const alt = `Centro de ayuda de ${APP_NAME}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  return renderOgCard({
    eyebrow: article ? `Ayuda · ${helpSectionTitle(article.section)}` : "Centro de ayuda",
    title: article?.title ?? "Centro de ayuda",
    foot: article ? `${article.readingMinutes} min de lectura` : undefined,
  });
}
