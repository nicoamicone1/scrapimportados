/**
 * Imagen de ejemplo para el seed: plano de color + nombre del producto, color
 * y talles, en SVG (4:5, la proporción de las tarjetas de «atelier»).
 *
 * `next/image` sirve los `.svg` tal cual (sin pasar por el optimizador) y el
 * bucket `media` acepta `image/svg+xml`, así que se suben como cualquier foto.
 * El fundador las reemplaza por fotos propias desde el panel.
 *
 * Puro: no lee ni escribe archivos.
 */

export interface PlaceholderInput {
  /** Nombre del producto (se parte en renglones). */
  title: string;
  /** Color de la variante ("Negro"); vacío si el producto no tiene colores. */
  color?: string;
  /** Renglón chico de abajo ("Talles S · M · L · XL"). */
  detail?: string;
  /** Fondo en hex (#RRGGBB). */
  background: string;
}

const WIDTH = 800;
const HEIGHT = 1000;
const FALLBACK_BG = "#D9D4CC";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = Number.parseInt(m[1], 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Corta el texto en renglones de hasta `max` caracteres sin partir palabras. */
export function wrapLines(text: string, max: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.trim().split(/\s+/)) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= max) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** SVG listo para subir (`image/svg+xml`). */
export function placeholderSvg({ title, color, detail, background }: PlaceholderInput): string {
  const bg = /^#[0-9a-f]{6}$/i.test(background) ? background : FALLBACK_BG;
  const dark = luminance(bg) < 0.32;
  const fg = dark ? "#FAF8F4" : "#1B1A18";
  const muted = dark ? "rgba(250,248,244,0.72)" : "rgba(27,26,24,0.66)";
  const rule = dark ? "rgba(250,248,244,0.35)" : "rgba(27,26,24,0.28)";

  const lines = wrapLines(title, 18).slice(0, 4);
  const lineHeight = 74;
  const top = HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2 - 40;
  const titleSpans = lines
    .map((line, i) => `<tspan x="${WIDTH / 2}" y="${Math.round(top + i * lineHeight)}">${escapeXml(line)}</tspan>`)
    .join("");
  const afterTitle = Math.round(top + (lines.length - 1) * lineHeight + 70);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml([title, color].filter(Boolean).join(", "))}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>`,
    `<rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" fill="none" stroke="${rule}" stroke-width="2"/>`,
    `<text text-anchor="middle" fill="${fg}" font-family="'Cormorant Garamond', Georgia, 'Times New Roman', serif" font-size="64" font-weight="500">${titleSpans}</text>`,
    `<line x1="${WIDTH / 2 - 40}" y1="${afterTitle}" x2="${WIDTH / 2 + 40}" y2="${afterTitle}" stroke="${rule}" stroke-width="2"/>`,
    color
      ? `<text x="${WIDTH / 2}" y="${afterTitle + 62}" text-anchor="middle" fill="${fg}" font-family="Jost, 'Helvetica Neue', Arial, sans-serif" font-size="34" letter-spacing="6">${escapeXml(color.toUpperCase())}</text>`
      : "",
    detail
      ? `<text x="${WIDTH / 2}" y="${afterTitle + (color ? 112 : 62)}" text-anchor="middle" fill="${muted}" font-family="Jost, 'Helvetica Neue', Arial, sans-serif" font-size="28">${escapeXml(detail)}</text>`
      : "",
    `<text x="${WIDTH / 2}" y="${HEIGHT - 80}" text-anchor="middle" fill="${muted}" font-family="Jost, 'Helvetica Neue', Arial, sans-serif" font-size="22" letter-spacing="4">FOTO DE EJEMPLO</text>`,
    `</svg>`,
  ].join("");
}
