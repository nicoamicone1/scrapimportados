import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "../og-card";

/*
 * Imagen para compartir del índice de guías (la página define su propio
 * `openGraph`, así que la imagen va acá).
 */

export const alt = `Guías de ${APP_NAME} para vender online en Argentina`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    tone: "tinta",
    eyebrow: "Guías",
    title: "Vender online en Argentina, sin vueltas.",
    highlight: "sin vueltas.",
    line: "Qué pide la ley, cómo ordenar las ventas y cómo mudarte sin perder Google.",
  });
}
