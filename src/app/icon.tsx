import { ImageResponse } from "next/og";

import { BrandTile } from "./_brand/glyph";

/*
 * Ícono de pestaña de toda la app (plataforma, panel y las tiendas que no
 * cargaron su propio favicon: la "e" es neutra). Una tienda con favicon lo
 * reemplaza desde `s/[store]/layout.tsx` (`icons`).
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandTile size={32} radius={6} glyph={0.72} />, { ...size });
}
