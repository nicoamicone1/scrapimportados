/*
 * La "e" de la marca dibujada como trazo, dentro de la burbuja (BRAND.md §4).
 * Es la única fuente del logo: favicon, imagen para compartir (`next/og`),
 * placas, sidebar del panel y landing (`BrandMark` en
 * `components/platform/brand.tsx`). Con un trazo queda igual de gruesa en
 * 16 px que en 1200 y no depende de la fuente del sistema. Las constantes
 * tienen que coincidir con `--eco-*` (globals.css): `next/og` no lee CSS.
 */

export const BRAND_INK = "#10162f"; // --eco-ink (texto, bandas oscuras, glifo)
export const BRAND_INK_2 = "#1a2244"; // --eco-ink-2
export const BRAND_POMELO = "#ff5a3c"; // --eco-pomelo (burbuja del logo, CTA de marca)
export const BRAND_POMELO_INK = "#b02c14"; // --eco-pomelo-ink (pomelo como texto sobre claro)
export const BRAND_DURAZNO = "#ffd3c4"; // --eco-durazno (formas grandes)
export const BRAND_AZUL = "#2f4bff"; // --eco-azul (links, interacción)
export const BRAND_NIEBLA = "#f4f5f9"; // --eco-niebla (fondo de página)
export const BRAND_PAPER = "#ffffff"; // --eco-paper
export const BRAND_MIST = "#e9ecf8"; // --eco-mist (texto sobre tinta)
export const BRAND_BRUMA = "#9aa3c7"; // --eco-bruma (texto secundario sobre tinta)
export const BRAND_FG = BRAND_INK; // --adm-fg = --eco-ink: una sola tinta
export const BRAND_MUTED = "#5b627a"; // --eco-text-muted
export const BRAND_BORDER = "#dfe2ec"; // --eco-line

/** Alias de la paleta anterior (pino/ámbar/crema). No usar en código nuevo. */
export const BRAND_AMBER = BRAND_POMELO;
export const BRAND_CREAM = BRAND_NIEBLA;
export const BRAND_PINE = BRAND_INK_2;

/** "e" minúscula bold: panza circular, barra horizontal y apertura abajo a la derecha. */
export function BrandGlyph({ size, color = BRAND_INK, draw = false }: { size: number; color?: string; draw?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="16 16 68 68" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path
        d="M24 50H76A26 26 0 1 0 69.9 66.7"
        fill="none"
        stroke={color}
        strokeWidth={13}
        pathLength={draw ? 1 : undefined}
        className={draw ? "eco-draw" : undefined}
      />
    </svg>
  );
}

/**
 * Radios de la burbuja para un lado dado: tres esquinas al 34 % y la inferior
 * izquierda al 8 % (la cola del mensaje, el ángulo de la etiqueta de precio).
 */
export function bubbleRadii(size: number): { borderTopLeftRadius: number; borderTopRightRadius: number; borderBottomRightRadius: number; borderBottomLeftRadius: number } {
  const big = Math.round(size * 0.34);
  return { borderTopLeftRadius: big, borderTopRightRadius: big, borderBottomRightRadius: big, borderBottomLeftRadius: Math.max(1, Math.round(size * 0.08)) };
}

/**
 * La burbuja pomelo con la "e" tinta (estilos inline: sirve en `next/og`).
 * `glyph` es la fracción del lado que ocupa la letra. `square` la deja sin
 * radios (ícono de iOS, que recorta solo). `background`/`color` sólo para
 * la versión monocroma.
 */
export function BrandTile({
  size,
  glyph = 0.58,
  square = false,
  background = BRAND_POMELO,
  color = BRAND_INK,
}: {
  size: number;
  glyph?: number;
  square?: boolean;
  background?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        ...(square ? {} : bubbleRadii(size)),
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BrandGlyph size={Math.round(size * glyph)} color={color} />
    </div>
  );
}
