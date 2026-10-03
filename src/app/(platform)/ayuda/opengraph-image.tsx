import { HELP_ARTICLES } from "@/content/ayuda";
import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "../og-card";

/*
 * Imagen para compartir del centro de ayuda. Hace falta acá porque la
 * página define su propio `openGraph` (título, descripción, url) y Next
 * reemplaza el objeto entero, imagen incluida.
 */

export const alt = `Centro de ayuda de ${APP_NAME}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    eyebrow: "Centro de ayuda",
    title: "¿Qué querés hacer en tu tienda?",
    highlight: "tienda?",
    line: `${HELP_ARTICLES.length} artículos cortos, con los nombres de cada pantalla del panel.`,
  });
}
