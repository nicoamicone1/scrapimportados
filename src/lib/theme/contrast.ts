import { contrastRatio } from "./css";
import type { ThemeColors } from "./schema";

/*
 * Contraste del tema (DESIGN.md §3.1): qué pares se controlan en el editor de
 * apariencia y cómo se corrige un color que no llega, sin cambiarle el tono.
 */

export interface ContrastCheck {
  fg: keyof ThemeColors;
  bg: keyof ThemeColors;
  /** 4.5 para texto, 3 para componentes de interfaz (botón sobre fondo). */
  min: number;
  label: string;
}

/** Los mismos pares que protege `presets.test.ts`, en el orden en que se leen en la tienda. */
export const CONTRAST_CHECKS: readonly ContrastCheck[] = [
  { fg: "text", bg: "background", min: 4.5, label: "Texto sobre fondo" },
  { fg: "textMuted", bg: "background", min: 4.5, label: "Texto secundario sobre fondo" },
  { fg: "textMuted", bg: "surface", min: 4.5, label: "Texto secundario sobre superficie" },
  { fg: "primaryText", bg: "primary", min: 4.5, label: "Texto del botón principal" },
  { fg: "primary", bg: "background", min: 3, label: "Botón principal sobre fondo" },
  { fg: "accent", bg: "background", min: 4.5, label: "Precio en oferta sobre fondo" },
  { fg: "accent", bg: "surface", min: 4.5, label: "Precio en oferta sobre superficie" },
  { fg: "text", bg: "secondary", min: 4.5, label: "Texto sobre la barra de anuncio" },
  { fg: "textMuted", bg: "secondary", min: 4.5, label: "Texto secundario sobre la barra de anuncio" },
  { fg: "success", bg: "background", min: 4.5, label: "Mensajes de éxito" },
  { fg: "danger", bg: "background", min: 4.5, label: "Errores y «Sin stock» sobre fondo" },
  { fg: "danger", bg: "surface", min: 4.5, label: "Errores sobre superficie (carrito, checkout)" },
];

export interface ContrastResult extends ContrastCheck {
  ratio: number;
  ok: boolean;
}

export function checkContrast(colors: ThemeColors): ContrastResult[] {
  return CONTRAST_CHECKS.map((ck) => {
    const ratio = contrastRatio(colors[ck.fg], colors[ck.bg]);
    return { ...ck, ratio, ok: ratio >= ck.min };
  });
}

// ---------------------------------------------------------------- OKLab

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklab(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => toLinear(parseInt(n.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * El color más parecido a `fg` (mismo tono, sólo cambia la luminosidad en
 * OKLab) que llega a `min`:1 contra `bg`. Prueba oscurecer y aclarar y se
 * queda con el cambio más chico; si ninguno llega, negro o blanco.
 */
export function fixContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg.toUpperCase();
  const [L, a, b] = hexToOklab(fg);
  const STEP = 0.005;
  let best: { hex: string; delta: number } | null = null;
  for (const dir of [-1, 1]) {
    for (let d = STEP; d <= 1; d += STEP) {
      const next = L + dir * d;
      if (next < 0 || next > 1) break;
      // Mismo a/b (tono y croma); lo que no entra en sRGB se recorta al convertir.
      const hex = oklabToHex([next, a, b]);
      if (contrastRatio(hex, bg) >= min) {
        if (!best || d < best.delta) best = { hex, delta: d };
        break;
      }
    }
  }
  if (best) return best.hex;
  return contrastRatio("#000000", bg) >= contrastRatio("#FFFFFF", bg) ? "#000000" : "#FFFFFF";
}

/**
 * Corrige un color del tema contra todos los fondos sobre los que se usa
 * (`textMuted` va sobre fondo, superficie y barra). Devuelve el color nuevo.
 */
export function fixThemeColor(colors: ThemeColors, key: keyof ThemeColors): string {
  let value = colors[key];
  const checks = CONTRAST_CHECKS.filter((ck) => ck.fg === key);
  // Dos pasadas: corregir contra la superficie puede dejar justo el fondo.
  for (let pass = 0; pass < 2; pass++) {
    for (const ck of checks) value = fixContrast(value, colors[ck.bg], ck.min);
  }
  return value;
}
