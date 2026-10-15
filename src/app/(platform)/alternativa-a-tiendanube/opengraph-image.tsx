import { TIENDANUBE_META } from "@/components/platform/landing-pages/content";
import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "../og-card";

/*
 * Imagen para compartir de /alternativa-a-tiendanube (la página define su propio
 * `openGraph` y sin este archivo se perdería la imagen del sitio).
 */

export const alt = `${APP_NAME}: ${TIENDANUBE_META.og.title}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({ ...TIENDANUBE_META.og, foot: "14 días de Pro gratis, sin tarjeta" });
}
