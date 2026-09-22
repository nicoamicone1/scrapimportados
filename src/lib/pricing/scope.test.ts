import { describe, expect, it } from "vitest";

import { categoryDescendants, categoryTree, couponStatus, expandCategoryIds, summarizeCategorySelection } from "./scope";

const cats = [
  { id: "hogar", name: "Hogar", parentId: null, position: 1 },
  { id: "cocina", name: "Cocina", parentId: "hogar", position: 2 },
  { id: "ollas", name: "Ollas", parentId: "cocina", position: 1 },
  { id: "bano", name: "Baño", parentId: "hogar", position: 1 },
  { id: "audio", name: "Audio", parentId: null, position: 0 },
  { id: "huerfana", name: "Huérfana", parentId: "no-existe", position: 0 },
];

describe("categoryTree", () => {
  it("ordena por árbol con profundidad y ruta", () => {
    const rows = categoryTree(cats);
    expect(rows.map((r) => `${r.depth}:${r.id}`)).toEqual(["0:audio", "0:huerfana", "0:hogar", "1:bano", "1:cocina", "2:ollas"]);
    expect(rows.find((r) => r.id === "ollas")?.path).toBe("Hogar / Cocina / Ollas");
  });
});

describe("descendientes", () => {
  it("incluye nietas y no la propia", () => {
    expect(categoryDescendants(cats, "hogar").sort()).toEqual(["bano", "cocina", "ollas"]);
    expect(categoryDescendants(cats, "ollas")).toEqual([]);
  });
  it("expandCategoryIds suma descendientes, sin duplicados ni ids inexistentes", () => {
    expect(expandCategoryIds(cats, ["cocina", "ollas", "fantasma"]).sort()).toEqual(["cocina", "ollas"]);
    expect(expandCategoryIds(cats, ["hogar"]).sort()).toEqual(["bano", "cocina", "hogar", "ollas"]);
  });
  it("tolera ciclos", () => {
    const loop = [
      { id: "a", name: "A", parentId: "b", position: 0 },
      { id: "b", name: "B", parentId: "a", position: 0 },
    ];
    expect(categoryDescendants(loop, "a")).toEqual(["b"]);
  });
});

describe("summarizeCategorySelection", () => {
  it("colapsa una madre con todas sus hijas", () => {
    expect(summarizeCategorySelection(cats, ["hogar", "cocina", "ollas", "bano"])).toEqual(["Hogar"]);
  });
  it("si falta alguna hija, lista las elegidas", () => {
    expect(summarizeCategorySelection(cats, ["hogar", "cocina"])).toEqual(["Hogar", "Cocina"]);
    expect(summarizeCategorySelection(cats, ["audio", "ollas"])).toEqual(["Audio", "Ollas"]);
  });
});

describe("couponStatus", () => {
  const NOW = new Date("2026-09-22T12:00:00Z");
  it("agotado cuando llegó al máximo", () => {
    expect(couponStatus({ isActive: true, usesCount: 5, maxUses: 5 }, NOW)).toBe("exhausted");
    expect(couponStatus({ isActive: true, usesCount: 4, maxUses: 5 }, NOW)).toBe("active");
    expect(couponStatus({ isActive: true, usesCount: 400, maxUses: null }, NOW)).toBe("active");
  });
  it("pausado y vencido tienen prioridad sobre agotado", () => {
    expect(couponStatus({ isActive: false, usesCount: 5, maxUses: 5 }, NOW)).toBe("paused");
    expect(couponStatus({ isActive: true, usesCount: 5, maxUses: 5, endsAt: "2026-01-01T00:00:00Z" }, NOW)).toBe("expired");
  });
  it("programado", () => {
    expect(couponStatus({ isActive: true, usesCount: 0, maxUses: null, startsAt: "2026-12-01T00:00:00Z" }, NOW)).toBe("scheduled");
  });
});
