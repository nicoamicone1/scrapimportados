import { describe, expect, it } from "vitest";

import { createBlock, PALETTE_ORDER } from "./defaults";
import { heroIsFullBleed, resolveHeroLayout } from "./hero";
import { blockSchema, BLOCK_TYPES, parseBlocks, type Block } from "./schema";
import { blockProductSource } from "./select";

const style = { background: "default", paddingY: "md", container: "normal" };

describe("bloques guardados antes de 2026-10 siguen validando", () => {
  it("portada sin layout ni productos → auto + los 4 más nuevos", () => {
    const r = blockSchema.parse({
      id: "h",
      type: "hero",
      style,
      settings: { title: "Hola", imageUrl: "", cta: { label: "Ver", href: "/productos" } },
    });
    expect(r.type === "hero" && r.settings.layout).toBe("auto");
    expect(r.type === "hero" && r.settings.products).toEqual({ kind: "newest", limit: 4 });
  });

  it("los ajustes nuevos toman su default", () => {
    const { blocks, errors } = parseBlocks([
      { id: "a", type: "features", style, settings: { items: [{ icon: "Truck", title: "Envíos", text: "" }] } },
      { id: "b", type: "faq", style, settings: { items: [] } },
      { id: "c", type: "countdown", style, settings: { title: "Termina", endsAt: "2026-10-10T23:59:00-03:00" } },
      { id: "d", type: "testimonials", style, settings: { items: [] } },
      { id: "e", type: "image_text", style, settings: { imageUrl: "", title: "T", html: "" } },
      { id: "f", type: "product_grid", style, settings: { title: "T", source: { kind: "newest", limit: 8 } } },
      { id: "g", type: "product_slider", style, settings: { title: "T", source: { kind: "newest", limit: 8 } } },
    ]);
    expect(errors).toBe(0);
    const by = Object.fromEntries(blocks.map((b) => [b.type, b.settings as Record<string, unknown>]));
    expect(by.features.layout).toBe("row");
    expect(by.faq.layout).toBe("list");
    expect(by.countdown.layout).toBe("inline");
    expect(by.testimonials.layout).toBe("cards");
    expect(by.image_text.layout).toBe("split");
    expect(by.product_grid.highlight).toBe("none");
    expect(by.product_slider.highlight).toBe("none");
  });

  it("la portada acepta `products: null` (sin productos) y rechaza disposiciones desconocidas", () => {
    const base = { id: "h", type: "hero", style, settings: { title: "Hola", imageUrl: "", cta: { label: "", href: "" } } };
    expect(blockSchema.safeParse({ ...base, settings: { ...base.settings, products: null } }).success).toBe(true);
    expect(blockSchema.safeParse({ ...base, settings: { ...base.settings, layout: "carousel" } }).success).toBe(false);
  });

  it("categorías: lista tipográfica válida, estilo desconocido no", () => {
    const cat = (s: string) => ({ id: "c", type: "category_list", style, settings: { categoryIds: "all", style: s } });
    expect(blockSchema.safeParse(cat("list")).success).toBe(true);
    expect(blockSchema.safeParse(cat("mosaic")).success).toBe(false);
  });
});

describe("bloques nuevos", () => {
  it("marquesina y colección destacada validan con sus defaults", () => {
    const m = blockSchema.parse({ id: "m", type: "marquee", style, settings: { items: ["Envíos a todo el país"] } });
    expect(m.type === "marquee" && m.settings).toMatchObject({ size: "sm", speed: "normal" });
    const l = blockSchema.parse({ id: "l", type: "lookbook", style, settings: { title: "Living", source: { kind: "newest", limit: 4 } } });
    expect(l.type === "lookbook" && l.settings).toMatchObject({ text: "", imageUrl: "", imagePosition: "left" });
  });

  it("la marquesina tiene un tope de 12 frases de 120 caracteres", () => {
    const many = Array.from({ length: 13 }, () => "x");
    expect(blockSchema.safeParse({ id: "m", type: "marquee", style, settings: { items: many } }).success).toBe(false);
    expect(blockSchema.safeParse({ id: "m", type: "marquee", style, settings: { items: ["x".repeat(121)] } }).success).toBe(false);
  });

  it("todo tipo tiene bloque nuevo válido y está en la paleta", () => {
    for (const type of BLOCK_TYPES) {
      expect(blockSchema.safeParse(createBlock(type)).success, type).toBe(true);
      expect(PALETTE_ORDER, type).toContain(type);
    }
  });
});

describe("disposición efectiva de la portada", () => {
  const hero = (layout: string, imageUrl = "") => createBlock("hero", { settings: { layout: layout as never, imageUrl } });

  it("auto sigue al tema; lo explícito manda", () => {
    expect(resolveHeroLayout(hero("auto").settings, "split")).toBe("split");
    expect(resolveHeroLayout(hero("stack").settings, "split")).toBe("stack");
  });

  it("a sangre sin foto se arma como titular", () => {
    expect(resolveHeroLayout(hero("cover").settings, "split")).toBe("poster");
    expect(resolveHeroLayout(hero("cover", "https://x/y.jpg").settings, "split")).toBe("cover");
    expect(resolveHeroLayout(hero("auto").settings, "cover")).toBe("poster");
  });

  it("el header transparente sólo va sobre una foto a sangre", () => {
    expect(heroIsFullBleed(hero("auto", "https://x/y.jpg"), "cover")).toBe(true);
    expect(heroIsFullBleed(hero("auto", "https://x/y.jpg"), "split")).toBe(false);
    expect(heroIsFullBleed(createBlock("faq"), "cover")).toBe(false);
    expect(heroIsFullBleed(undefined, "cover")).toBe(false);
  });
});

describe("fuente de productos por bloque", () => {
  it("portada: hasta 6; null = sin productos", () => {
    const h = createBlock("hero", { settings: { products: { kind: "newest", limit: 12 } } });
    expect(blockProductSource(h)).toEqual({ kind: "newest", limit: 6 });
    expect(blockProductSource(createBlock("hero", { settings: { products: null } }))).toBeNull();
  });

  it("colección destacada: hasta 4 (también en manual)", () => {
    const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`);
    const l = createBlock("lookbook", { settings: { source: { kind: "manual", productIds: ids } } });
    expect(blockProductSource(l)).toEqual({ kind: "manual", productIds: ids.slice(0, 4) });
  });

  it("grilla con filas: filas × columnas pisa el límite; bloques sin productos → null", () => {
    const g = createBlock("product_grid", { settings: { columns: 5, rows: 2, source: { kind: "newest", limit: 40 } } });
    expect(blockProductSource(g)).toEqual({ kind: "newest", limit: 10 });
    expect(blockProductSource(createBlock("faq") as Block)).toBeNull();
  });
});
