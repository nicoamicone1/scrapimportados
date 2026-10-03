import { describe, expect, it } from "vitest";

import { PRESET_IDS } from "@/lib/theme/schema";

import { blockSchema, type Block } from "./schema";
import { defaultHomeFor, isStarterPreset, STARTER_TEMPLATES, starterHomeBlocks } from "./starters";

const PRESETS = PRESET_IDS.filter((p) => p !== "custom");
const opts = { storeName: "Taller Luna", transferDiscount: 10, whatsapp: true };

/** Huella de la composición: tipo + variante principal de cada bloque. */
function signature(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "category_list":
          return `cat:${b.settings.style}`;
        case "features":
          return `feat:${b.settings.layout}`;
        case "faq":
          return `faq:${b.settings.layout}`;
        case "marquee":
          return `mq:${b.settings.size}`;
        case "product_grid":
          return `grid:${b.settings.columns}:${b.settings.highlight}`;
        case "product_slider":
          return `slider:${b.settings.cardsPerView}:${b.settings.highlight}`;
        case "hero":
          return `hero:${b.settings.height}:${b.settings.align}`;
        default:
          return b.type;
      }
    })
    .join(" ");
}

describe("portadas de fábrica por preset", () => {
  it("cada preset tiene su composición y todas validan", () => {
    for (const preset of PRESETS) {
      const blocks = defaultHomeFor(preset, opts);
      expect(blocks.length, preset).toBeGreaterThanOrEqual(4);
      for (const b of blocks) expect(blockSchema.safeParse(b).success, `${preset} ${b.type}`).toBe(true);
      expect(blocks[0].type, preset).toBe("hero");
    }
  });

  it("no hay dos composiciones iguales", () => {
    const sigs = PRESETS.map((p) => signature(defaultHomeFor(p, opts)));
    expect(new Set(sigs).size).toBe(PRESETS.length);
  });

  it("todas responden al link «Cómo comprar» del menú de fábrica (/#como-comprar)", () => {
    for (const preset of PRESETS) {
      const faq = defaultHomeFor(preset, opts).find((b) => b.type === "faq");
      expect(faq?.type === "faq" && faq.settings.title, preset).toBe("Cómo comprar");
    }
  });

  it("los ids son estables y únicos para la home de una tienda nueva", () => {
    for (const preset of PRESETS) {
      const a = starterHomeBlocks(preset, opts).map((b) => b.id);
      const b = starterHomeBlocks(preset, opts).map((x) => x.id);
      expect(a).toEqual(b);
      expect(new Set(a).size, preset).toBe(a.length);
      expect(a.every((id) => id.startsWith("home-"))).toBe(true);
    }
  });

  it("sin descuento por transferencia no promete descuento", () => {
    for (const preset of PRESETS) {
      const json = JSON.stringify(defaultHomeFor(preset, { storeName: "X", transferDiscount: 0, whatsapp: false }));
      expect(json, preset).not.toMatch(/% (off|de descuento)/);
      expect(json, preset).not.toMatch(/WhatsApp\.?"/);
    }
  });

  it("usa el % real de la tienda y nunca reseñas", () => {
    const json = JSON.stringify(defaultHomeFor("nordico", { storeName: "X", transferDiscount: 15 }));
    expect(json).toContain("15 %");
    for (const preset of PRESETS) expect(defaultHomeFor(preset, opts).some((b) => b.type === "testimonials")).toBe(false);
  });

  it("preset desconocido o custom → la de nordico", () => {
    expect(signature(defaultHomeFor("custom", opts))).toBe(signature(defaultHomeFor("nordico", opts)));
    expect(isStarterPreset("custom")).toBe(false);
    expect(isStarterPreset("galpon")).toBe(true);
  });

  it("la foto de la portada sólo entra si se pasa", () => {
    const withImage = defaultHomeFor("atelier", { ...opts, heroImageUrl: "https://x/y.jpg" })[0];
    expect(withImage.type === "hero" && withImage.settings.imageUrl).toBe("https://x/y.jpg");
    const without = defaultHomeFor("atelier", opts)[0];
    expect(without.type === "hero" && without.settings.imageUrl).toBe("");
  });

  it("hay una plantilla por preset en el constructor", () => {
    expect(STARTER_TEMPLATES.map((t) => t.preset).sort()).toEqual([...PRESETS].sort());
  });
});
