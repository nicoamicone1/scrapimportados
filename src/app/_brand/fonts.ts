import { Archivo } from "next/font/google";

/*
 * Archivo (Omnibus-Type, Buenos Aires), variable en peso y ancho: la voz de
 * la marca (BRAND §6). Display en expandida y pesada (`.eco-display`,
 * `.eco-num`), texto de la landing en ancho normal. `next/font` la
 * autohospeda (ninguna hoja de Google en el HTML) y ajusta el fallback para
 * CLS ≈ 0. La comparten el sitio de la plataforma y el panel: se aplica con
 * `archivo.variable` en el contenedor `.admin-root`.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
  axes: ["wdth"],
  variable: "--font-archivo",
});
