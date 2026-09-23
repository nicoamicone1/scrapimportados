/*
 * La "e" de la marca (BrandMark en PlatformChrome) dibujada como trazo, para
 * los íconos y la imagen para compartir generados con `next/og`: ahí no hay
 * fuentes del sistema y la única que trae `ImageResponse` es regular. Con
 * un trazo queda igual de gruesa en 32 px que en 1200.
 */

export const BRAND_INK = "#1a2320"; // --adm-sidebar-bg (verde-tinta)
export const BRAND_AMBER = "#e0a458"; // --adm-accent-2 (ámbar)
export const BRAND_CREAM = "#efeae1"; // --adm-bg
export const BRAND_PINE = "#2e4a3f"; // --adm-accent
export const BRAND_FG = "#1c1917"; // --adm-fg
export const BRAND_MUTED = "#6b6860"; // --adm-fg-muted
export const BRAND_BORDER = "#e2dbcd"; // --adm-border

/** "e" minúscula bold: panza circular, barra horizontal y apertura abajo a la derecha. */
export function BrandGlyph({ size, color = BRAND_AMBER }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="16 16 68 68" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 50H76A26 26 0 1 0 69.9 66.7" fill="none" stroke={color} strokeWidth={13} />
    </svg>
  );
}

/** Cuadrado verde-tinta con la "e" ámbar, como BrandMark. `glyph` es la fracción del lado que ocupa la letra. */
export function BrandTile({ size, radius, glyph = 0.62 }: { size: number; radius: number; glyph?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: BRAND_INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BrandGlyph size={Math.round(size * glyph)} />
    </div>
  );
}
