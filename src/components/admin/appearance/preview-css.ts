import { cssVars, isDarkTheme, sanitizeCustomCss, themeFontsHref, type Theme } from "@/lib/theme";

/*
 * CSS del tema para los previews del admin (apariencia y builder), SIN
 * iframe: las variables se aplican a `#preview-root` y los breakpoints de
 * `cssVars` (media queries del viewport) se resuelven según el dispositivo
 * elegido: en "desktop" se aplican siempre, en "mobile" nunca. Los bloques
 * usan container queries, así que se acomodan solos al ancho del preview.
 */

export type PreviewDevice = "mobile" | "desktop";

export const PREVIEW_WIDTH: Record<PreviewDevice, number> = { mobile: 390, desktop: 1280 };

const MEDIA_BLOCK = /@media \(min-width:\d+px\)\{([^{}]*\{[^{}]*\})\}/g;

export function previewCss(theme: Theme, selector: string, device: PreviewDevice): string {
  const base = cssVars({ ...theme, custom_css: undefined }, selector);
  const resolved = device === "desktop" ? base.replace(MEDIA_BLOCK, "$1") : base.replace(MEDIA_BLOCK, "");
  const custom = theme.custom_css?.trim() ? `${selector}{${sanitizeCustomCss(theme.custom_css)}}` : "";
  return [resolved, custom].filter(Boolean).join("\n");
}

/** Mismos data-atributos que pone el layout del storefront en `.store-root`. */
export function storeRootAttrs(theme: Theme): Record<string, string | undefined> {
  const dark = isDarkTheme(theme);
  return {
    "data-btn": theme.buttons.style,
    "data-btn-upper": theme.buttons.uppercase ? "1" : undefined,
    "data-dark": dark ? "1" : undefined,
    "data-glow": dark && theme.effects.shadows !== "none" ? "1" : undefined,
    "data-shadows": theme.effects.shadows,
  };
}

export { themeFontsHref };
