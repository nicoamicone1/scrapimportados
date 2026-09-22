import { closestWeight, fontStack, googleHref } from "./fonts";
import { DEFAULT_THEME } from "./presets";
import { themeSchema, type Theme } from "./schema";

/**
 * Tema → CSS variables del storefront (docs/DESIGN.md §3).
 *
 * `(store)/layout.tsx` inyecta `cssVars(theme)` en un `<style>`. En
 * `globals.css`, `@theme inline` mapea los colores (`--color-bg: var(--bg)`…)
 * para escribir `bg-bg text-fg bg-primary text-primary-fg border-border`.
 * Radios, fuentes y escala tipográfica pisan directamente las variables de
 * Tailwind (`--radius-md`, `--font-heading`, `--text-sm`…), así que
 * `rounded-md`, `font-heading` y `text-sm` ya usan los valores del tema.
 */

const RADIUS: Record<Theme["radius"], [string, string, string]> = {
  none: ["0px", "0px", "0px"],
  sm: ["2px", "4px", "6px"],
  md: ["4px", "8px", "10px"],
  lg: ["6px", "12px", "16px"],
  full: ["8px", "16px", "24px"],
};

const CONTAINER: Record<Theme["layout"]["containerWidth"], string> = {
  narrow: "1080px",
  normal: "1280px",
  wide: "1520px",
};

interface DensityTokens {
  sectionSm: string;
  sectionMd: string;
  sectionLg: string;
  gap: [string, string];
  cardPad: string;
  controlH: string;
  headerH: [string, string];
}

const DENSITY: Record<Theme["layout"]["density"], DensityTokens> = {
  compact: { sectionSm: "24px", sectionMd: "40px", sectionLg: "56px", gap: ["8px", "12px"], cardPad: "8px", controlH: "40px", headerH: ["52px", "60px"] },
  comfortable: { sectionSm: "32px", sectionMd: "56px", sectionLg: "80px", gap: ["12px", "20px"], cardPad: "12px", controlH: "44px", headerH: ["56px", "68px"] },
  airy: { sectionSm: "48px", sectionMd: "80px", sectionLg: "120px", gap: ["16px", "32px"], cardPad: "16px", controlH: "48px", headerH: ["60px", "84px"] },
};

const SHADOWS: Record<Theme["effects"]["shadows"], [string, string, string]> = {
  none: ["none", "none", "0 0 0 1px var(--border)"],
  soft: [
    "0 1px 2px rgb(0 0 0 / .05)",
    "0 6px 16px -8px rgb(0 0 0 / .14)",
    "0 16px 40px -16px rgb(0 0 0 / .22)",
  ],
  strong: [
    "0 1px 3px rgb(0 0 0 / .10)",
    "0 10px 24px -10px rgb(0 0 0 / .24)",
    "0 24px 56px -20px rgb(0 0 0 / .35)",
  ],
};

const RATIO: Record<Theme["cards"]["imageRatio"], string> = {
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "3:4": "3 / 4",
  "16:9": "16 / 9",
};

/** Luminancia relativa WCAG de un hex #RRGGBB. */
export function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function isDarkTheme(theme: Theme): boolean {
  return luminance(theme.colors.background) < 0.2;
}

/** Normaliza un valor de la DB a un `Theme` válido (con defaults si falta algo). */
export function parseTheme(value: unknown): Theme {
  const direct = themeSchema.safeParse(value);
  if (direct.success) return direct.data;
  if (value && typeof value === "object") {
    // Merge por sección con el default: tolera temas guardados parcialmente.
    const v = value as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...DEFAULT_THEME };
    for (const [key, def] of Object.entries(DEFAULT_THEME)) {
      const incoming = v[key];
      if (incoming === undefined) continue;
      merged[key] =
        def && typeof def === "object" && incoming && typeof incoming === "object"
          ? { ...def, ...(incoming as object) }
          : incoming;
    }
    const retry = themeSchema.safeParse(merged);
    if (retry.success) return retry.data;
  }
  return DEFAULT_THEME;
}

/** Variables base del tema (mobile). Útil también para `style={}` en previews. */
export function themeVars(theme: Theme): Record<string, string> {
  const c = theme.colors;
  const f = theme.fonts;
  const [rSm, rMd, rLg] = RADIUS[theme.radius];
  const d = DENSITY[theme.layout.density];
  const dark = isDarkTheme(theme);
  const [shSm, shMd, shLg] = SHADOWS[theme.effects.shadows];
  const B = f.baseSize;
  const tracking =
    f.headingTracking === "tight"
      ? f.headingTransform === "uppercase"
        ? "-0.01em"
        : "-0.02em"
      : f.headingTracking === "wide"
        ? "0.08em"
        : "0em";
  const btnRadius = theme.buttons.shape === "pill" ? "9999px" : theme.buttons.shape === "square" ? "0px" : rMd;
  const cardShadow = dark ? "0 0 0 1px var(--border)" : shSm;

  return {
    // Colores
    "--bg": c.background,
    "--surface": c.surface,
    "--fg": c.text,
    "--fg-muted": c.textMuted,
    "--primary": c.primary,
    "--primary-fg": c.primaryText,
    "--secondary": c.secondary,
    "--accent": c.accent,
    "--border": c.border,
    "--success": c.success,
    "--danger": c.danger,
    "--border-strong": "color-mix(in oklab, var(--fg) 38%, var(--bg))",
    "--primary-hover": "color-mix(in oklab, var(--primary) 86%, var(--fg))",
    "--primary-soft": "color-mix(in oklab, var(--primary) 12%, var(--bg))",
    "--is-dark": dark ? "1" : "0",
    // Radios
    "--radius-sm": rSm,
    "--radius-md": rMd,
    "--radius-lg": rLg,
    "--radius-pill": "9999px",
    "--btn-radius": btnRadius,
    // Tipografía
    "--font-heading": fontStack(f.heading),
    "--font-body": fontStack(f.body),
    "--heading-weight": String(f.headingWeight),
    "--body-weight": String(f.bodyWeight),
    "--body-strong-weight": String(closestWeight(f.body, Math.min(f.bodyWeight + 200, 700))),
    "--heading-transform": f.headingTransform,
    "--heading-tracking": tracking,
    "--base-size": `${B}px`,
    "--text-xs": `${B * 0.75}px`,
    "--text-sm": `${B * 0.875}px`,
    "--text-base": `${B}px`,
    "--text-lg": `${B * 1.125}px`,
    "--text-xl": `${B * 1.375}px`,
    "--text-2xl": `clamp(${B * 1.5}px, 2.2vw, ${B * 2}px)`,
    "--text-display": `clamp(${B * 2.25}px, 5vw, ${B * 4.5}px)`,
    // Botones
    "--btn-transform": theme.buttons.uppercase ? "uppercase" : "none",
    "--btn-tracking": theme.buttons.uppercase ? "0.1em" : "0em",
    // Sombras
    "--shadow-sm": shSm,
    "--shadow-md": shMd,
    "--shadow-lg": shLg,
    "--shadow-card": cardShadow,
    // Layout y densidad (mobile; desktop en media query)
    "--container": CONTAINER[theme.layout.containerWidth],
    "--gutter": "16px",
    "--space-section-sm": d.sectionSm,
    "--space-section-md": d.sectionMd,
    "--space-section-lg": d.sectionLg,
    "--gap-grid": d.gap[0],
    "--card-pad": d.cardPad,
    "--control-h": d.controlH,
    "--header-h": d.headerH[0],
    "--grid-cols": String(theme.layout.gridColumns.mobile),
    // Cards
    "--card-ratio": RATIO[theme.cards.imageRatio],
    "--card-fit": theme.cards.imageRatio === "1:1" || theme.cards.imageRatio === "16:9" ? "contain" : "cover",
  };
}

/**
 * Sanea CSS custom del usuario: saca `@import`, `url(javascript:…)`,
 * `expression()`, `behavior:` y cualquier intento de cerrar el `<style>`.
 */
export function sanitizeCustomCss(css: string): string {
  return css
    .replace(/<\/?\s*style[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\s*\(\s*(['"]?)\s*(javascript|vbscript|data:text\/html)[^)]*\)/gi, "none")
    .replace(/expression\s*\(/gi, "(")
    .replace(/behavior\s*:/gi, "x-behavior:")
    .replace(/-moz-binding\s*:/gi, "x-binding:");
}

function block(selector: string, vars: Record<string, string>): string {
  return `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}

/**
 * CSS completo del tema: `:root{…}` + breakpoints de densidad + custom CSS
 * saneado. Listo para `<style dangerouslySetInnerHTML>` (no contiene `</style>`).
 */
export function cssVars(theme: Theme, selector = ":root"): string {
  const d = DENSITY[theme.layout.density];
  const desktopCols = theme.layout.gridColumns.desktop;
  const parts = [
    block(selector, themeVars(theme)),
    `@media (min-width:640px){${block(selector, { "--gutter": "24px" })}}`,
    `@media (min-width:768px){${block(selector, { "--grid-cols": String(Math.max(2, desktopCols - 1)) })}}`,
    `@media (min-width:1024px){${block(selector, {
      "--gutter": "40px",
      "--gap-grid": d.gap[1],
      "--header-h": d.headerH[1],
      "--grid-cols": String(desktopCols),
    })}}`,
  ];
  if (theme.custom_css) parts.push(sanitizeCustomCss(theme.custom_css));
  return parts.join("\n");
}

/**
 * URL de Google Fonts del tema: sólo headingWeight, bodyWeight y
 * bodyWeight + 200 (acotado) — máximo 3 archivos (DESIGN.md §3.2).
 */
export function themeFontsHref(theme: Theme): string | null {
  const f = theme.fonts;
  return googleHref([
    { id: f.heading, weights: [f.headingWeight] },
    { id: f.body, weights: [f.bodyWeight, Math.min(f.bodyWeight + 200, 700)] },
  ]);
}
