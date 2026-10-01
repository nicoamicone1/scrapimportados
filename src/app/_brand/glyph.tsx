/*
 * La "e" de la marca dibujada como trazo (BRAND.md §4.1). Es la única fuente
 * del logo: favicon, imagen para compartir (`next/og`), placas, sidebar del
 * panel y landing (`BrandMark` en `components/platform/brand.tsx`). Con un
 * trazo queda igual de gruesa en 16 px que en 1200 y no depende de la fuente
 * del sistema. Las constantes tienen que coincidir con `--eco-*` (globals.css):
 * `next/og` no lee CSS.
 */

export const BRAND_INK = "#1a2320"; // --eco-ink (texto, sidebar, tile)
export const BRAND_AMBER = "#e0a458"; // --eco-amber (glifo)
export const BRAND_CREAM = "#efeae1"; // --eco-cream
export const BRAND_PINE = "#2e4a3f"; // --eco-pine
export const BRAND_FG = "#1a2320"; // --adm-fg = --eco-ink (BRAND §5.4: una sola tinta)
export const BRAND_MUTED = "#6b6860"; // --eco-text-muted
export const BRAND_BORDER = "#e2dbcd"; // --eco-line

/** "e" minúscula bold: panza circular, barra horizontal y apertura abajo a la derecha. */
export function BrandGlyph({ size, color = BRAND_AMBER }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="16 16 68 68" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M24 50H76A26 26 0 1 0 69.9 66.7" fill="none" stroke={color} strokeWidth={13} />
    </svg>
  );
}

/**
 * Cuadrado con la "e" ámbar (estilos inline: sirve en `next/og`). `glyph` es la
 * fracción del lado que ocupa la letra; `radius` por defecto es el 18 % del
 * lado; `background` = tinta (fondos claros) o `BRAND_PINE` sobre fondos tinta.
 */
export function BrandTile({
  size,
  radius = Math.round(size * 0.18),
  glyph = 0.62,
  background = BRAND_INK,
}: {
  size: number;
  radius?: number;
  glyph?: number;
  background?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BrandGlyph size={Math.round(size * glyph)} />
    </div>
  );
}
