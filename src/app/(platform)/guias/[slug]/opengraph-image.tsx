import { GUIDES } from "@/content/guias";

/*
 * La misma imagen para compartir del sitio (ver `../opengraph-image.tsx`):
 * el artículo define su propio `openGraph` y sin este archivo se perdería.
 * `generateStaticParams`: se genera en el build, una por guía, en vez de
 * dibujarse en cada pedido de un crawler.
 */
export { alt, contentType, default, size } from "../../opengraph-image";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}
