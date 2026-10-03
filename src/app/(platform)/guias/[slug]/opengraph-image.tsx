import { getGuide, GUIDES } from "@/content/guias";
import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "../../og-card";

/*
 * Imagen para compartir de cada guía, con su título, sobre tinta (la guía
 * define su propio `openGraph` y sin este archivo se perdería).
 * `generateStaticParams`: se genera en el build, una por guía.
 */

export const alt = `Guía de ${APP_NAME}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  return renderOgCard({
    tone: "tinta",
    eyebrow: guide ? `Guía · ${guide.section}` : "Guías",
    title: guide?.title ?? "Guías para vender online en Argentina",
    foot: guide ? `${guide.readingMinutes} min de lectura` : undefined,
  });
}
