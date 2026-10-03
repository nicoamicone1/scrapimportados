import { ImageResponse } from "next/og";

import { BrandTile } from "./_brand/glyph";

/* Ícono para la pantalla de inicio de iOS: a sangre (iOS redondea las esquinas). */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandTile size={180} square glyph={0.56} />, { ...size });
}
