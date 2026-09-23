import { ImageResponse } from "next/og";

import { PLATFORM_EMAIL } from "@/components/platform/site";
import { APP_NAME } from "@/lib/version";

import { BRAND_BORDER, BRAND_CREAM, BRAND_FG, BRAND_MUTED, BRAND_PINE, BrandTile } from "../_brand/glyph";

/*
 * Imagen para compartir del sitio de la plataforma (landing, planes,
 * legales, contacto…). Vive en (platform) y no en la raíz porque el
 * `openGraph` de `(platform)/layout.tsx` y el de la landing reemplazan al
 * de los segmentos de arriba, imagen incluida; los archivos de esta carpeta
 * se aplican después de esos objetos. Las tiendas no la heredan: tienen su
 * propia imagen (SEO de la tienda) o ninguna.
 */

export const alt = `${APP_NAME}: tu tienda online, sin comisión por venta`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DOMAIN = PLATFORM_EMAIL.split("@")[1] ?? "ecommy.app";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: BRAND_CREAM,
        color: BRAND_FG,
        padding: "64px 72px 56px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <BrandTile size={64} radius={10} glyph={0.6} />
        <div style={{ fontSize: 40, letterSpacing: -1 }}>{APP_NAME}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", fontSize: 88, lineHeight: 1.02, letterSpacing: -3.5 }}>
        <div>Tu tienda online,</div>
        <div style={{ color: BRAND_PINE }}>sin comisión por venta.</div>
      </div>
      <div style={{ marginTop: 28, fontSize: 30, lineHeight: 1.3, color: BRAND_MUTED, maxWidth: 900 }}>
        Los pedidos te llegan armados por WhatsApp y cobrás por transferencia. 14 días de Pro gratis, sin tarjeta.
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 44,
          paddingTop: 22,
          borderTop: `2px solid ${BRAND_BORDER}`,
          fontSize: 26,
        }}
      >
        <div style={{ color: BRAND_PINE }}>{DOMAIN}</div>
        <div style={{ color: BRAND_MUTED }}>Tiendas online para pymes argentinas</div>
      </div>
    </div>,
    { ...size },
  );
}
