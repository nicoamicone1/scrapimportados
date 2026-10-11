import { describe, expect, it } from "vitest";

import { saveThemeSchema, validateCustomCss } from "@/lib/schemas/appearance";
import { contrastRatio, sanitizeCustomCss } from "@/lib/theme/css";
import { getFont } from "@/lib/theme/fonts";
import { PRESETS } from "@/lib/theme/presets";
import { themeSchema, type Theme } from "@/lib/theme/schema";

import { LUNA_CSS } from "./custom-css";
import { LUNA_THEME } from "./theme";

/**
 * Tema a medida de la demo Luna: los mismos mínimos que se les exigen a los
 * presets (`presets.test.ts`) más los del CSS personalizado que guarda el panel.
 */

/** Distancia en OKLab (igual que en presets.test.ts). */
function oklabDistance(a: string, b: string): number {
  const lab = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/**
 * Selectores de todas las reglas de estilo del CSS (las de adentro de
 * @media/@supports incluidas; los pasos de @keyframes no son selectores).
 */
function ruleSelectors(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  const stack: ("group" | "keyframes" | "rule")[] = [];
  let buf = "";
  for (const ch of src) {
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      if (stack.includes("keyframes")) stack.push("rule");
      else if (prelude.startsWith("@keyframes")) stack.push("keyframes");
      else if (prelude.startsWith("@")) stack.push("group");
      else {
        out.push(prelude);
        stack.push("rule");
      }
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else if (ch === ";" && stack.at(-1) === "rule") {
      buf = "";
    } else {
      buf += ch;
    }
  }
  return out;
}

/** Parte una lista de selectores por las comas de primer nivel (no las de `:is()`). */
function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

describe("LUNA_THEME", () => {
  it("es un tema válido, `custom`, con el CSS de marca y el crédito encendido", () => {
    expect(themeSchema.parse(LUNA_THEME)).toEqual(LUNA_THEME);
    expect(LUNA_THEME.preset).toBe("custom");
    expect(LUNA_THEME.custom_css).toBe(LUNA_CSS);
    expect(LUNA_THEME.footer.showCredit).toBe(true);
  });

  it("se puede guardar desde el panel (saveThemeSchema valida también el CSS)", () => {
    expect(saveThemeSchema.safeParse(LUNA_THEME).success).toBe(true);
  });

  it("par tipográfico: Instrument Serif 400 en títulos y un cuerpo que no es sólo de títulos", () => {
    expect(LUNA_THEME.fonts.heading).toBe("instrument-serif");
    expect(LUNA_THEME.fonts.headingWeight).toBe(400);
    expect(getFont(LUNA_THEME.fonts.body).headingOnly ?? false).toBe(false);
    for (const [id, t] of Object.entries(PRESETS)) {
      expect(`${t.fonts.heading}+${t.fonts.body}`, id).not.toBe(`${LUNA_THEME.fonts.heading}+${LUNA_THEME.fonts.body}`);
    }
  });

  it("no es un preset con otro skin: difiere de cada uno en al menos 4 de 10 ejes", () => {
    const axes = (t: Theme) => [
      t.header.layout,
      t.footer.style,
      t.style.hero,
      t.style.titles,
      t.style.shape,
      t.style.card,
      t.style.motion,
      t.style.grid,
      t.style.filters,
      t.style.gallery,
    ];
    const luna = axes(LUNA_THEME);
    for (const [id, preset] of Object.entries(PRESETS)) {
      const diff = axes(preset).filter((v, k) => v !== luna[k]).length;
      expect(diff, `luna vs ${id}`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("LUNA_THEME: contraste WCAG 2.1 (mismas reglas que los presets)", () => {
  const c = LUNA_THEME.colors;

  it("texto, muted, acento, éxito y peligro ≥ 4.5:1 sobre fondo y superficie", () => {
    for (const role of ["text", "textMuted", "accent", "success", "danger"] as const) {
      expect(contrastRatio(c[role], c.background), `${role}/background`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c[role], c.surface), `${role}/surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("texto principal ≥ 7:1 sobre el fondo", () => {
    expect(contrastRatio(c.text, c.background)).toBeGreaterThanOrEqual(7);
  });

  it("primaryText ≥ 4.5:1 sobre primary y primary ≥ 3:1 sobre fondo, superficie y banda secundaria", () => {
    expect(contrastRatio(c.primaryText, c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.primary, c.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.primary, c.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.primary, c.secondary)).toBeGreaterThanOrEqual(3);
  });

  it("texto y muted se leen sobre la banda secundaria (≥ 4.5:1)", () => {
    expect(contrastRatio(c.text, c.secondary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.textMuted, c.secondary)).toBeGreaterThanOrEqual(4.5);
  });

  it("acento y peligro se distinguen a simple vista", () => {
    const d = oklabDistance(c.accent, c.danger);
    expect(d === 0 || d >= 0.08, `ΔE_oklab = ${d.toFixed(3)}`).toBe(true);
  });

  it("los colores literales del CSS contrastan donde se usan", () => {
    // Amarillo luna sólo sobre noche; crema del sello sobre el acento.
    expect(contrastRatio("#F2D76B", c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#F4F1E8", c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#F4F1E8", c.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("LUNA_CSS", () => {
  it("entra en los 20 KB del panel y pasa su validación", () => {
    expect(new TextEncoder().encode(LUNA_CSS).length).toBeLessThan(20 * 1024);
    expect(validateCustomCss(LUNA_CSS)).toEqual([]);
  });

  it("queda intacto después del saneado del storefront", () => {
    expect(sanitizeCustomCss(LUNA_CSS)).toBe(LUNA_CSS);
  });

  it("no carga nada de afuera (sin @import ni url() que no sean data:)", () => {
    expect(LUNA_CSS).not.toMatch(/@import/i);
    for (const m of LUNA_CSS.matchAll(/url\(\s*(['"]?)([^'")]*)/gi)) {
      expect(m[2].startsWith("data:") || m[2].startsWith("%23"), m[0]).toBe(true);
    }
  });

  it("todas las reglas están prefijadas con .store-root (no tocan nada fuera de la tienda)", () => {
    const selectors = ruleSelectors(LUNA_CSS).flatMap(splitSelectorList);
    expect(selectors.length).toBeGreaterThan(40);
    for (const sel of selectors) expect(sel.startsWith(".store-root"), sel).toBe(true);
  });

  it("apaga el movimiento con prefers-reduced-motion y anima sólo con no-preference", () => {
    expect(LUNA_CSS).toContain("@media (prefers-reduced-motion: reduce)");
    expect(LUNA_CSS).toMatch(/@supports \(animation-timeline: view\(\)\)\s*\{\s*@media \(prefers-reduced-motion: no-preference\)/);
  });
});
