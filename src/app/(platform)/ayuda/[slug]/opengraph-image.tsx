import { HELP_ARTICLES } from "@/content/ayuda";

/*
 * La misma imagen para compartir del sitio (ver `../opengraph-image.tsx`):
 * el artículo define su propio `openGraph` y sin este archivo se perdería.
 * `generateStaticParams`: se genera en el build, una por artículo, en vez de
 * dibujarse en cada pedido de un crawler.
 */
export { alt, contentType, default, size } from "../../opengraph-image";

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}
