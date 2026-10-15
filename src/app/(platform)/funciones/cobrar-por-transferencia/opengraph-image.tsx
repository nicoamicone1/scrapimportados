import { TRANSFER_META } from "@/components/platform/landing-pages/content";
import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "../../og-card";

/*
 * Imagen para compartir de /funciones/cobrar-por-transferencia (la página define su propio
 * `openGraph` y sin este archivo se perdería la imagen del sitio).
 */

export const alt = `${APP_NAME}: ${TRANSFER_META.og.title}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({ ...TRANSFER_META.og, foot: "Sin comisión por venta" });
}
