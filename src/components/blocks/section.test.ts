import { describe, expect, it } from "vitest";

import { createBlock } from "@/lib/blocks/defaults";

import { hasSectionTitle, needsDivider, sectionIndexes } from "./Section";

describe("numeración de secciones (titles: index)", () => {
  it("cuenta sólo los bloques que abren con título de sección", () => {
    const blocks = [
      createBlock("hero"),
      createBlock("marquee"),
      createBlock("product_grid"),
      createBlock("heading", { settings: { level: 1, text: "Grande" } }),
      createBlock("category_list"),
      createBlock("faq"),
    ];
    expect(blocks.map(hasSectionTitle)).toEqual([false, false, true, false, true, true]);
    expect(sectionIndexes(blocks)).toEqual([0, 0, 0, 1, 1, 2]);
  });

  it("sin título no se numera", () => {
    expect(hasSectionTitle(createBlock("category_list", { settings: { title: undefined } }))).toBe(false);
  });
});

describe("reglas entre bloques", () => {
  it("la marquesina no lleva regla (es una banda)", () => {
    expect(needsDivider(createBlock("product_grid"), createBlock("marquee"))).toBe(false);
  });
});
