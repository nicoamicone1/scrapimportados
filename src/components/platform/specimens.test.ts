import { describe, expect, it } from "vitest";

import { PRESETS } from "@/lib/theme";

import { presetSpecimens, specimenFontSheets, specimenTexts } from "./specimens";

describe("specimenFontSheets", () => {
  const specimens = presetSpecimens();

  it("arma una hoja por preset, con sólo sus 2 familias", () => {
    const sheets = specimenFontSheets(specimens.map((s) => ({ presetId: s.presetId, texts: specimenTexts(s, null) })));
    expect(Object.keys(sheets).sort()).toEqual(specimens.map((s) => s.presetId).sort());
    for (const s of specimens) {
      const href = sheets[s.presetId] ?? "";
      expect(href.match(/family=/g)).toHaveLength(PRESETS[s.presetId].fonts.heading === PRESETS[s.presetId].fonts.body ? 1 : 2);
      expect(href).toContain("display=swap");
      expect(href).toContain("&text=");
    }
  });

  it("une los textos de todos los usos del mismo preset (hero + muestra)", () => {
    const sheets = specimenFontSheets([
      { presetId: "mercado", texts: ["Taller Luna"] },
      { presetId: "mercado", texts: ["Cerámica"] },
    ]);
    expect(Object.keys(sheets)).toEqual(["mercado"]);
    const text = decodeURIComponent(sheets.mercado?.split("&text=")[1] ?? "");
    for (const ch of "TallerLunaCerámica") expect(text).toContain(ch);
  });

  it("incluye en el recorte el precio y la etiqueta del plan", () => {
    const [s] = specimens;
    const texts = specimenTexts(s, "Incluido en Free");
    expect(texts).toContain(" · Incluido en Free");
    expect(texts.some((t) => t.includes("$"))).toBe(true);
  });
});
