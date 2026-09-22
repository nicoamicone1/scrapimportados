/**
 * Lista curada de Google Fonts para el tema del storefront (docs/DESIGN.md §5).
 *
 * - `id` es lo que se guarda en `store_settings.theme.fonts.*`.
 * - `weights`: pesos disponibles (en fuentes variables, los múltiplos de 100 del rango).
 * - `headingOnly`: sólo se ofrecen para títulos (display, mono y serifs de display).
 * - Se cargan con un `<link>` a css2 (no `next/font`: el tema es dinámico).
 *
 * Excluidas a propósito: Inter, Roboto, Poppins, Montserrat, Playfair Display, Open Sans, Lato.
 */

export type FontCategory = "serif" | "sans" | "display" | "mono";

export interface FontDef {
  id: string;
  family: string;
  category: FontCategory;
  weights: readonly number[];
  headingOnly?: boolean;
  /** Para qué sirve (se muestra en el selector del admin). */
  hint: string;
}

function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let w = min; w <= max; w += 100) out.push(w);
  return out;
}

export const FONTS = [
  { id: "cormorant-garamond", family: "Cormorant Garamond", category: "serif", weights: range(300, 700), headingOnly: true, hint: "Títulos grandes de moda y joyería" },
  { id: "instrument-serif", family: "Instrument Serif", category: "serif", weights: [400], headingOnly: true, hint: "Display editorial fino, sólo títulos" },
  { id: "fraunces", family: "Fraunces", category: "serif", weights: range(100, 900), hint: "Títulos cálidos: artesanal, gastronomía" },
  { id: "libre-caslon-text", family: "Libre Caslon Text", category: "serif", weights: range(400, 700), hint: "Librerías, vinos, marcas clásicas" },
  { id: "newsreader", family: "Newsreader", category: "serif", weights: range(200, 800), hint: "Textos largos de tono periodístico" },
  { id: "lora", family: "Lora", category: "serif", weights: range(400, 700), hint: "Cuerpo serif amable" },
  { id: "literata", family: "Literata", category: "serif", weights: range(200, 900), hint: "Cuerpo serif muy legible en pantalla" },
  { id: "jost", family: "Jost", category: "sans", weights: range(100, 900), hint: "Geométrica tipo Futura: moda, perfumería" },
  { id: "dm-sans", family: "DM Sans", category: "sans", weights: range(100, 900), hint: "Cuerpo neutro y compacto" },
  { id: "manrope", family: "Manrope", category: "sans", weights: range(200, 800), hint: "Tecnología y electro; cifras nítidas" },
  { id: "figtree", family: "Figtree", category: "sans", weights: range(300, 900), hint: "Amistosa y clara: juguetería, bazar" },
  { id: "nunito-sans", family: "Nunito Sans", category: "sans", weights: range(200, 900), hint: "Humanista suave: artesanías, bienestar" },
  { id: "karla", family: "Karla", category: "sans", weights: range(200, 800), hint: "Grotesca con carácter: marcas indie" },
  { id: "work-sans", family: "Work Sans", category: "sans", weights: range(100, 900), hint: "Robusta: ferreterías, industria" },
  { id: "plus-jakarta-sans", family: "Plus Jakarta Sans", category: "sans", weights: range(200, 800), hint: "Cosmética, estética, servicios" },
  { id: "schibsted-grotesk", family: "Schibsted Grotesk", category: "sans", weights: range(400, 900), hint: "Cuerpo editorial" },
  { id: "ibm-plex-sans", family: "IBM Plex Sans", category: "sans", weights: range(100, 700), hint: "Catálogos técnicos, repuestos" },
  { id: "sora", family: "Sora", category: "sans", weights: range(100, 800), hint: "Títulos geométricos de electro y hogar" },
  { id: "space-grotesk", family: "Space Grotesk", category: "sans", weights: range(300, 700), hint: "Técnica con rasgos propios: gaming, audio" },
  { id: "bricolage-grotesque", family: "Bricolage Grotesque", category: "sans", weights: range(200, 800), hint: "Títulos expresivos: marcas jóvenes" },
  { id: "barlow-condensed", family: "Barlow Condensed", category: "display", weights: range(100, 900), headingOnly: true, hint: "Titulares condensados en mayúsculas" },
  { id: "archivo-narrow", family: "Archivo Narrow", category: "display", weights: range(400, 700), headingOnly: true, hint: "Titulares angostos sobrios" },
  { id: "syne", family: "Syne", category: "display", weights: range(400, 800), headingOnly: true, hint: "Arte, diseño, galerías; tamaños grandes" },
  { id: "unbounded", family: "Unbounded", category: "display", weights: range(200, 900), headingOnly: true, hint: "Anchos y técnicos: gaming, música" },
  { id: "jetbrains-mono", family: "JetBrains Mono", category: "mono", weights: range(100, 800), headingOnly: true, hint: "Títulos técnicos, specs" },
  { id: "ibm-plex-mono", family: "IBM Plex Mono", category: "mono", weights: range(100, 700), headingOnly: true, hint: "Marcas de laboratorio" },
] as const satisfies readonly FontDef[];

export type GoogleFontId = (typeof FONTS)[number]["id"];

export const FONT_IDS = FONTS.map((f) => f.id) as [GoogleFontId, ...GoogleFontId[]];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: "Serif",
  sans: "Sans serif",
  display: "Display",
  mono: "Monoespaciada",
};

const FALLBACKS: Record<FontCategory, string> = {
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  display: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  mono: "ui-monospace, SFMono-Regular, Consolas, monospace",
};

export function getFont(id: string): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

/** Peso disponible más cercano al pedido. */
export function closestWeight(id: string, weight: number): number {
  const { weights } = getFont(id);
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0]);
}

/** `font-family` completo con fallback de su categoría, listo para una CSS variable. */
export function fontStack(id: string): string {
  const f = getFont(id);
  return `"${f.family}", ${FALLBACKS[f.category]}`;
}

export interface FontRequest {
  id: string;
  /** Pesos a pedir; si se omite, todos los de la fuente (útil en el selector del admin). */
  weights?: number[];
}

/**
 * URL de Google Fonts css2. Une pesos si la misma familia aparece dos veces.
 *   googleHref([{ id: "fraunces", weights: [600] }, { id: "nunito-sans", weights: [400, 600] }])
 *   → https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Nunito+Sans:wght@400;600&display=swap
 */
export function googleHref(requests: readonly (FontRequest | string)[]): string | null {
  const merged = new Map<string, Set<number>>();
  for (const req of requests) {
    const r = typeof req === "string" ? { id: req } : req;
    const font = getFont(r.id);
    const set = merged.get(font.id) ?? new Set<number>();
    for (const w of r.weights ?? font.weights) set.add(closestWeight(font.id, w));
    merged.set(font.id, set);
  }
  if (merged.size === 0) return null;
  const families = [...merged.entries()].map(([id, set]) => {
    const font = getFont(id);
    const name = font.family.replace(/ /g, "+");
    const weights = [...set].sort((a, b) => a - b);
    return weights.length === 1 && weights[0] === 400 && font.weights.length === 1
      ? `family=${name}`
      : `family=${name}:wght@${weights.join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
