import { describe, expect, it } from "vitest";

import { checkContrast, CONTRAST_CHECKS, fixContrast, fixThemeColor } from "./contrast";
import { contrastRatio } from "./css";
import { PRESETS } from "./presets";

describe("checkContrast", () => {
  it("los 10 presets pasan todos los controles del editor", () => {
    for (const [id, t] of Object.entries(PRESETS)) {
      const failing = checkContrast(t.colors).filter((r) => !r.ok);
      expect(failing.map((f) => f.label), id).toEqual([]);
    }
  });

  it("no repite pares", () => {
    const keys = CONTRAST_CHECKS.map((c) => `${c.fg}/${c.bg}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("fixContrast", () => {
  it("deja igual un color que ya cumple", () => {
    expect(fixContrast("#1b1a18", "#FAF8F4", 4.5)).toBe("#1B1A18");
  });

  it("oscurece un gris claro sobre blanco hasta 4.5:1, sin pasarse a negro", () => {
    const out = fixContrast("#A0A0A0", "#FFFFFF", 4.5);
    expect(contrastRatio(out, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out, "#FFFFFF")).toBeLessThan(5.2);
  });

  it("aclara sobre un fondo oscuro y conserva el tono (un naranja sigue siendo naranja)", () => {
    const out = fixContrast("#8A4B00", "#0D0D0C", 4.5);
    expect(contrastRatio(out, "#0D0D0C")).toBeGreaterThanOrEqual(4.5);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it("un texto blanco sobre un botón amarillo pasa a oscuro", () => {
    const out = fixContrast("#FFFFFF", "#FFD23F", 4.5);
    expect(contrastRatio(out, "#FFD23F")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("fixThemeColor", () => {
  it("corrige el texto secundario contra fondo, superficie y barra a la vez", () => {
    const colors = { ...PRESETS.atelier.colors, textMuted: "#A8A29A" };
    const fixed = fixThemeColor(colors, "textMuted");
    for (const bg of ["background", "surface", "secondary"] as const) {
      expect(contrastRatio(fixed, colors[bg]), bg).toBeGreaterThanOrEqual(4.5);
    }
  });
});
