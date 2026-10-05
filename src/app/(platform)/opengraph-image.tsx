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

export const alt = `${APP_NAME}: vendés por WhatsApp e Instagram, ahora con orden`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "Hecho para vender en Argentina",
    title: "Vendés por WhatsApp e Instagram. Ahora, con orden.",
    highlight: "con orden",
    line: "Tu tienda, cada pedido registrado y un panel que te dice qué hacer hoy. Sin comisión por venta.",
    foot: "14 días de Pro gratis, sin tarjeta",
  });
}
