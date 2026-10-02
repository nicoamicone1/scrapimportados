import { describe, expect, it } from "vitest";

import { createBlock, PAGE_TEMPLATES_META } from "@/lib/blocks/defaults";

import { blocksWithExampleCopy, hasExampleCopy } from "./example-copy";

describe("texto de ejemplo sin tocar", () => {
  it("marca los bloques nuevos con afirmaciones de otra tienda", () => {
    for (const type of ["hero", "image_text", "features", "faq", "countdown", "rich_text"] as const) {
      expect(hasExampleCopy(createBlock(type)), type).toBe(true);
    }
  });

  it("no marca títulos genéricos ni bloques de productos", () => {
    for (const type of ["product_slider", "product_grid", "category_list", "heading", "divider", "testimonials", "video"] as const) {
      expect(hasExampleCopy(createBlock(type)), type).toBe(false);
    }
  });

  it("deja de marcar cuando el dueño reescribe el texto", () => {
    const block = createBlock("image_text", { settings: { title: "Cerámica de Tilcara", html: "<p>Hacemos cada pieza a mano desde 2019.</p>" } });
    expect(hasExampleCopy(block)).toBe(false);
  });

  it("ignora los bloques ocultos y detecta el copy de las plantillas", () => {
    expect(hasExampleCopy(createBlock("hero", { style: { hidden: true } }))).toBe(false);
    const legal = PAGE_TEMPLATES_META.find((t) => t.id === "legal")!.build();
    expect(blocksWithExampleCopy(legal).map((b) => b.type)).toEqual(["rich_text"]);
  });
});
