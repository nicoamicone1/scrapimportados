import { describe, expect, it } from "vitest";

import { blockSchema, BLOCK_TYPES, defaultBlock, parseBlocks } from "./blocks";
import { formatMoney, parseMoney, roundMoney } from "./money";
import { slugify } from "./slug";
import { cssVars, googleHref, parseTheme, PRESETS, themeFontsHref, themeSchema } from "./theme";

describe("money", () => {
  it("formatea ARS sin decimales si es entero", () => {
    expect(formatMoney(41262)).toBe("$ 41.262");
    expect(formatMoney(1234.5)).toBe("$ 1.234,50");
    expect(formatMoney(null)).toBe("—");
  });
  it("redondea y parsea", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(parseMoney("$ 1.234,50")).toBe(1234.5);
    expect(parseMoney("12.500")).toBe(12500);
  });
});

describe("slugify", () => {
  it("saca acentos y símbolos", () => {
    expect(slugify("Café & Té — Edición 2026")).toBe("cafe-y-te-edicion-2026");
    expect(slugify("  Ñandú!!  ")).toBe("nandu");
  });
});

describe("theme", () => {
  it("todos los presets son válidos", () => {
    for (const preset of Object.values(PRESETS)) expect(themeSchema.safeParse(preset).success).toBe(true);
  });
  it("parseTheme completa temas parciales con defaults", () => {
    const t = parseTheme({ colors: { primary: "#ff0000" } });
    expect(t.colors.primary).toBe("#ff0000");
    expect(t.fonts.body).toBeTruthy();
  });
  it("cssVars genera variables y sanea custom_css", () => {
    const css = cssVars({ ...PRESETS.neon, custom_css: "@import url(x.css); a{color:red}</style><script>" });
    expect(css).toContain("--primary:#C6FF3D");
    expect(css).toContain("--btn-radius:8px");
    expect(css).toContain("--is-dark:1");
    expect(css).toContain("@media (min-width:1024px)");
    expect(css).not.toContain("@import");
    expect(css).not.toContain("</style>");
  });
  it("googleHref arma la URL de css2 y une pesos por familia", () => {
    expect(
      googleHref([
        { id: "fraunces", weights: [600] },
        { id: "nunito-sans", weights: [400, 600] },
        { id: "instrument-serif" },
      ]),
    ).toBe(
      "https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Nunito+Sans:wght@400;600&family=Instrument+Serif&display=swap",
    );
  });
  it("themeFontsHref pide como máximo 3 pesos", () => {
    expect(themeFontsHref(PRESETS.nordico)).toBe(
      "https://fonts.googleapis.com/css2?family=Sora:wght@600&family=Manrope:wght@400;600&display=swap",
    );
  });
  it("valida que el peso exista en la fuente", () => {
    const bad = { ...PRESETS.atelier, fonts: { ...PRESETS.atelier.fonts, headingWeight: 900 } };
    expect(themeSchema.safeParse(bad).success).toBe(false);
  });
});

describe("blocks", () => {
  it("defaultBlock genera bloques válidos para todos los tipos", () => {
    for (const type of BLOCK_TYPES) {
      const block = defaultBlock(type);
      expect(block.type).toBe(type);
      expect(blockSchema.safeParse(block).success).toBe(true);
    }
  });
  it("parseBlocks descarta bloques inválidos sin romper la página", () => {
    const { blocks, errors } = parseBlocks([defaultBlock("heading"), { type: "html", id: "x" }]);
    expect(blocks).toHaveLength(1);
    expect(errors).toBe(1);
  });
});
