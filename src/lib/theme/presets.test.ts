import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STORE_KINDS } from "@/lib/tenant/kinds";

import { contrastRatio } from "./css";
import { getFont } from "./fonts";
import { PRESET_LIST, PRESETS } from "./presets";
import { PRESET_IDS, themeSchema } from "./schema";

/**
 * Protege el curado de presets (docs/DESIGN.md §4): si alguien toca un color,
 * el contraste mínimo tiene que seguir cumpliéndose.
 */

const entries = Object.entries(PRESETS);

/** Distancia en OKLab (0 = mismo color; ~0.02 es apenas perceptible). */
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

describe("presets: catálogo", () => {
  it("PRESET_LIST cubre exactamente PRESET_IDS sin 'custom', sin repetir", () => {
    const listed = PRESET_LIST.map((p) => p.id);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(PRESET_IDS.filter((id) => id !== "custom").sort());
    expect(Object.keys(PRESETS).sort()).toEqual([...listed].sort());
  });

  it("cada preset es válido y su `preset` coincide con la clave", () => {
    for (const [id, theme] of entries) {
      expect(themeSchema.safeParse(theme).success, id).toBe(true);
      expect(theme.preset, id).toBe(id);
    }
  });

  it("metadatos completos: 2–4 rubros, mood corto, descripción de una línea", () => {
    for (const meta of PRESET_LIST) {
      expect(meta.name.length, meta.id).toBeGreaterThan(2);
      expect(meta.industries.length, meta.id).toBeGreaterThanOrEqual(2);
      expect(meta.industries.length, meta.id).toBeLessThanOrEqual(4);
      expect(meta.mood.split(" ").length, meta.id).toBeLessThanOrEqual(4);
      expect(meta.description.length, meta.id).toBeLessThanOrEqual(140);
    }
  });

  it("no hay dos presets con el mismo par tipográfico", () => {
    const pairs = entries.map(([, t]) => `${t.fonts.heading}+${t.fonts.body}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("el cuerpo nunca usa una fuente sólo para títulos", () => {
    for (const [id, t] of entries) expect(getFont(t.fonts.body).headingOnly ?? false, id).toBe(false);
  });
});

describe("presets: contraste WCAG 2.1", () => {
  const TEXT_ROLES = ["text", "textMuted", "accent", "success", "danger"] as const;

  for (const [id, theme] of entries) {
    const c = theme.colors;
    it(`${id}: texto, muted, acento, éxito y peligro ≥ 4.5:1 sobre fondo y superficie`, () => {
      for (const role of TEXT_ROLES) {
        expect(contrastRatio(c[role], c.background), `${role}/background`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(c[role], c.surface), `${role}/surface`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${id}: texto principal ≥ 7:1 sobre el fondo`, () => {
      expect(contrastRatio(c.text, c.background)).toBeGreaterThanOrEqual(7);
    });
    it(`${id}: primaryText ≥ 4.5:1 sobre primary y primary ≥ 3:1 sobre el fondo`, () => {
      expect(contrastRatio(c.primaryText, c.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.primary, c.background)).toBeGreaterThanOrEqual(3);
    });
    it(`${id}: el texto se lee sobre la banda secundaria (≥ 4.5:1)`, () => {
      expect(contrastRatio(c.text, c.secondary)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${id}: acento y peligro son el mismo color o se distinguen a simple vista`, () => {
      // Dos rojos casi iguales (promo vs. error en el mismo drawer) se leen como un error de copia.
      const d = oklabDistance(c.accent, c.danger);
      expect(d === 0 || d >= 0.08, `ΔE_oklab = ${d.toFixed(3)}`).toBe(true);
    });
  }
});

describe("rubros del alta → preset", () => {
  it("cada rubro apunta a un preset existente y 'otro' cae en nordico", () => {
    for (const kind of STORE_KINDS) expect(Object.hasOwn(PRESETS, kind.preset), kind.id).toBe(true);
    expect(STORE_KINDS.find((k) => k.id === "otro")?.preset).toBe("nordico");
  });

  it("kinds.ts es espejo del `case` de create_store() en la última migración que lo define", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    const latest = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .filter((sql) => sql.includes("create or replace function public.create_store("))
      .at(-1);
    expect(latest).toBeTruthy();
    const fn = latest!.slice(latest!.indexOf("create or replace function public.create_store("));
    const caseBlock = fn.slice(fn.indexOf("v_preset := case p_kind"), fn.indexOf("end;", fn.indexOf("v_preset := case p_kind")));
    const sqlMap = Object.fromEntries([...caseBlock.matchAll(/when '([a-z]+)' then '([a-z]+)'/g)].map((m) => [m[1], m[2]]));
    const tsMap = Object.fromEntries(STORE_KINDS.filter((k) => k.id !== "otro").map((k) => [k.id, k.preset]));
    expect(sqlMap).toEqual(tsMap);
    expect(caseBlock).toContain("else 'nordico'");
  });
});
