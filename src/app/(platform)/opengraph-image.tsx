import { APP_NAME } from "@/lib/version";

import { OG_SIZE, renderOgCard } from "./og-card";

/*
 * Imagen para compartir del sitio de la plataforma (landing, planes,
 * legales, contacto…). Vive en (platform) y no en la raíz porque el
 * `openGraph` de `(platform)/layout.tsx` y el de la landing reemplazan al
 * de los segmentos de arriba, imagen incluida; los archivos de esta carpeta
 * se aplican después de esos objetos. Las tiendas no la heredan: tienen su
 * propia imagen (SEO de la tienda) o ninguna. El dibujo está en `og-card.tsx`.
 */

export const alt = `${APP_NAME}: dejá de preguntar «¿qué talle?», el pedido te llega armado`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Para marcas que venden por Instagram y WhatsApp",
    title: "Dejá de preguntar «¿qué talle?». El pedido te llega armado.",
    highlight: "armado",
    line: "Tu clienta elige talle y color, y a vos te llega el pedido a WhatsApp con todo. Sin comisión por venta.",
    foot: "14 días de Pro gratis, sin tarjeta",
  });
}
