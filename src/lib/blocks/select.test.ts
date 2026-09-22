import { describe, expect, it } from "vitest";

import type { Promotion } from "@/lib/pricing";

import { categoryWithDescendants, isOnSale, selectCategories, selectProductIds, type SelectableCategory, type SelectableProduct } from "./select";

const cats: SelectableCategory[] = [
  { id: "hogar", name: "Hogar", slug: "hogar", imageUrl: null, parentId: null, position: 1 },
  { id: "cocina", name: "Cocina", slug: "cocina", imageUrl: null, parentId: "hogar", position: 0 },
  { id: "vajilla", name: "Vajilla", slug: "vajilla", imageUrl: null, parentId: "cocina", position: 0 },
  { id: "audio", name: "Audio", slug: "audio", imageUrl: "https://x/audio.jpg", parentId: null, position: 0 },
  { id: "vacia", name: "Vacía", slug: "vacia", imageUrl: null, parentId: null, position: 2 },
];

function p(id: string, extra: Partial<SelectableProduct> = {}): SelectableProduct {
  return {
    id,
    categoryIds: [],
    hasCompareAt: false,
    available: true,
    featured: false,
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

const index: SelectableProduct[] = [
  p("a", { categoryIds: ["vajilla"], createdAt: "2026-03-01T00:00:00Z" }),
  p("b", { categoryIds: ["audio"], createdAt: "2026-05-01T00:00:00Z", featured: true, tags: ["Ciberlunes"] }),
  p("c", { categoryIds: ["cocina"], createdAt: "2026-04-01T00:00:00Z", available: false }),
  p("d", { categoryIds: ["hogar"], createdAt: "2026-02-01T00:00:00Z", hasCompareAt: true }),
  p("e", { categoryIds: ["audio"], createdAt: "2026-06-01T00:00:00Z", available: false, featured: true }),
];

const promo: Promotion = {
  id: "promo-audio",
  name: "Audio 20",
  type: "percent",
  value: 20,
  scope: "categories",
  categoryIds: ["audio"],
  productIds: [],
  isActive: true,
  priority: 1,
  stackable: false,
};

const opts = { categories: cats, promotions: [] as Promotion[], now: new Date("2026-09-22T12:00:00Z") };

describe("selectProductIds", () => {
  it("manual: respeta el orden, descarta inactivos y duplicados", () => {
    expect(selectProductIds({ kind: "manual", productIds: ["d", "zz", "a", "d"] }, index, opts)).toEqual(["d", "a"]);
  });

  it("category: incluye subcategorías, más nuevos primero y agotados al final", () => {
    expect(selectProductIds({ kind: "category", categoryId: "hogar", limit: 10 }, index, opts)).toEqual(["a", "d", "c"]);
    expect(selectProductIds({ kind: "category", categoryId: "cocina", limit: 10 }, index, opts)).toEqual(["a", "c"]);
  });

  it("respeta el límite", () => {
    expect(selectProductIds({ kind: "newest", limit: 2 }, index, opts)).toEqual(["b", "a"]);
  });

  it("newest: ordena por fecha con los agotados al final", () => {
    expect(selectProductIds({ kind: "newest", limit: 10 }, index, opts)).toEqual(["b", "a", "d", "e", "c"]);
  });

  it("tag: sin distinguir mayúsculas", () => {
    expect(selectProductIds({ kind: "tag", tag: "ciberlunes", limit: 10 }, index, opts)).toEqual(["b"]);
  });

  it("featured", () => {
    expect(selectProductIds({ kind: "featured", limit: 10 }, index, opts)).toEqual(["b", "e"]);
  });

  it("on_sale: precio tachado o promo vigente", () => {
    expect(selectProductIds({ kind: "on_sale", limit: 10 }, index, opts)).toEqual(["d"]);
    expect(selectProductIds({ kind: "on_sale", limit: 10 }, index, { ...opts, promotions: [promo] })).toEqual(["b", "d", "e"]);
  });

  it("on_sale: ignora promos vencidas o inactivas", () => {
    const expired = { ...promo, endsAt: "2026-09-01T00:00:00Z" };
    const inactive = { ...promo, isActive: false };
    expect(isOnSale(index[1], [expired], opts.now)).toBe(false);
    expect(isOnSale(index[1], [inactive], opts.now)).toBe(false);
    expect(isOnSale(index[1], [promo], opts.now)).toBe(true);
  });
});

describe("categorías", () => {
  it("categoryWithDescendants recorre todos los niveles", () => {
    expect([...categoryWithDescendants(cats, "hogar")].sort()).toEqual(["cocina", "hogar", "vajilla"]);
  });

  it("'all' devuelve raíces con productos, en orden de posición", () => {
    const picks = selectCategories("all", cats, index);
    expect(picks.map((x) => x.category.id)).toEqual(["audio", "hogar"]);
    expect(picks.find((x) => x.category.id === "hogar")?.productCount).toBe(3);
    // Portada: primer producto con stock.
    expect(picks.find((x) => x.category.id === "audio")?.coverProductId).toBe("b");
  });

  it("lista explícita: respeta el orden y no filtra vacías", () => {
    const picks = selectCategories(["vacia", "cocina", "no-existe"], cats, index);
    expect(picks.map((x) => [x.category.id, x.productCount])).toEqual([
      ["vacia", 0],
      ["cocina", 2],
    ]);
  });
});
