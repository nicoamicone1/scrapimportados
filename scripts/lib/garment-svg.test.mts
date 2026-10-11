import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { garmentKind, garmentSvg, moonPhase } from "./garment-svg.mjs";

interface DemoProduct {
  name: string;
  slug: string;
  options?: { name: string; values: string[] }[];
}

const demo = JSON.parse(readFileSync(new URL("../../data/demo-ropa.json", import.meta.url), "utf8")) as {
  swatches: Record<string, string>;
  products: DemoProduct[];
};

function colorsOf(p: DemoProduct): (string | undefined)[] {
  return p.options?.find((o) => o.name.toLowerCase() === "color")?.values ?? [undefined];
}

/** Etiquetas abiertas y cerradas balanceadas (un parser mínimo, sin DOM). */
function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, close, tag, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== tag) return false;
    } else stack.push(tag);
  }
  return stack.length === 0;
}

describe("garmentKind", () => {
  it("reconoce las 32 prendas de la demo", () => {
    for (const p of demo.products) expect(garmentKind(p.name), p.name).not.toBeNull();
  });

  it("distingue los tipos por el nombre", () => {
    expect(garmentKind("Buzo canguro de frisa")).toBe("hoodie");
    expect(garmentKind("Buzo cuello redondo de frisa")).toBe("sweatshirt");
    expect(garmentKind("Campera inflable corta")).toBe("puffer");
    expect(garmentKind("Pantalón de frisa con puño")).toBe("jogger");
    expect(garmentKind("Pantalón wide beige")).toBe("pantsWide");
    expect(garmentKind("Vestido largo con breteles")).toBe("dressSlip");
    expect(garmentKind("Camisa de gasa con lazo")).toBe("blouseBow");
    expect(garmentKind("Medias de algodón por 3 pares")).toBe("socks");
    expect(garmentKind("Remera rayada marinera")).toBe("teeStriped");
  });

  it("devuelve null si no es una prenda", () => {
    expect(garmentKind("Taza de cerámica")).toBeNull();
    expect(garmentSvg({ name: "Taza de cerámica", hex: "#FFFFFF" })).toBeNull();
  });
});

describe("garmentSvg", () => {
  const all = demo.products.flatMap((p) =>
    colorsOf(p).map((color) => ({ p, color, svg: garmentSvg({ name: p.name, color, hex: (color && demo.swatches[color]) || "", seed: p.slug }) })),
  );

  it("genera un SVG 800×1000 liviano, sin scripts ni recursos externos, por producto × color", () => {
    expect(all.length).toBeGreaterThan(60);
    for (const { p, color, svg } of all) {
      const label = `${p.name} · ${color}`;
      expect(svg, label).toBeTruthy();
      expect(svg!.startsWith("<svg "), label).toBe(true);
      expect(svg, label).toContain('viewBox="0 0 800 1000"');
      expect(svg, label).not.toMatch(/<script|on[a-z]+=|href="(?!#)|url\((?!#)|@import|<image/i);
      expect(svg!.length, label).toBeLessThan(30 * 1024);
      expect(balanced(svg!), label).toBe(true);
    }
  });

  it("dice honestamente que es una ilustración, con el color", () => {
    const svg = garmentSvg({ name: "Remera básica de algodón", color: "Arena", hex: "#D8C7A8", seed: "x" })!;
    expect(svg).toContain("Ilustración · Arena");
    expect(svg).not.toContain("Foto");
    expect(garmentSvg({ name: "Remera básica de algodón", hex: "#D8C7A8" })).toContain(">Ilustración<");
  });

  it("es determinística y la fase de la luna cambia entre productos", () => {
    const a = garmentSvg({ name: "Saco de hilo trenzado", color: "Crudo", hex: "#EAE2D2", seed: "saco" });
    expect(garmentSvg({ name: "Saco de hilo trenzado", color: "Crudo", hex: "#EAE2D2", seed: "saco" })).toBe(a);
    const phases = new Set(demo.products.map((p) => moonPhase(p.slug)));
    expect(phases.size).toBeGreaterThanOrEqual(5);
    for (const ph of phases) expect(ph).toBeGreaterThanOrEqual(0);
  });

  it("usa el color de la raya sobre crudo y el fondo del floral", () => {
    const azul = garmentSvg({ name: "Remera rayada marinera", color: "Rayas azules", hex: "#2E4A7A" })!;
    expect(azul).toMatch(/<pattern id="stripes"[^]*?fill="#2E4A7A"/);
    expect(azul).toContain('fill="#EAE2D2"');
    const floral = garmentSvg({ name: "Vestido midi de fibrana estampado", color: "Floral terracota", hex: "#C27A54" })!;
    expect(floral).toContain('<pattern id="floral"');
    expect(floral).toContain('fill="#C27A54"');
  });

  it("aplica la textura del tejido", () => {
    expect(garmentSvg({ name: "Musculosa acanalada", color: "Blanco", hex: "#F4F2EE" })).toMatch(/<pattern id="rib/);
    expect(garmentSvg({ name: "Pantalón de corderoy", color: "Caramelo", hex: "#A26C3A" })).toMatch(/<pattern id="cord/);
    expect(garmentSvg({ name: "Saco de hilo trenzado", color: "Negro", hex: "#1B1A18" })).toMatch(/<pattern id="cablel/);
    expect(garmentSvg({ name: "Pantalón ancho de lino", color: "Crudo", hex: "#EAE2D2" })).toMatch(/<pattern id="linen/);
    expect(garmentSvg({ name: "Buzo canguro de frisa", color: "Gris jaspeado", hex: "#A3A09B" })).toMatch(/<pattern id="heather/);
  });

  it("en prendas muy oscuras las líneas interiores van claras", () => {
    const negro = garmentSvg({ name: "Remera básica de algodón", color: "Negro", hex: "#1B1A18" })!;
    const blanco = garmentSvg({ name: "Remera básica de algodón", color: "Blanco", hex: "#F4F2EE" })!;
    const strokes = (svg: string) => new Set([...svg.matchAll(/stroke="(#[0-9A-F]{6})"/gi)].map((m) => m[1].toUpperCase()));
    expect([...strokes(negro)].some((c) => c !== "#15133A" && c !== "#FFFFFF")).toBe(true);
    expect(strokes(blanco)).toContain("#15133A");
  });
});
