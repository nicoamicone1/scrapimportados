import { describe, expect, it } from "vitest";

import type { PresetMeta } from "@/lib/theme";

import { EMPTY_PRESET_FILTER, filterPresets, matchesQuery, normalize } from "./preset-filter";

const A = { id: "atelier", name: "Atelier", description: "Moda y joyería.", industries: ["Moda", "Joyería"], mood: "Silencioso y aireado" } as PresetMeta;
const B = { id: "mercado", name: "Mercado", description: "Artesanías y deco.", industries: ["Artesanías", "Dietética"], mood: "Cálido y cercano" } as PresetMeta;
const C = { id: "neon", name: "Neón", description: "Gaming.", industries: ["Gaming", "Sneakers"], mood: "Oscuro y disciplinado" } as PresetMeta;
const LIST = [A, B, C];
const deps = { isDark: (id: string) => id === "neon", isAllowed: (id: string) => id !== "atelier" };

describe("preset-filter", () => {
  it("normaliza tildes y mayúsculas", () => {
    expect(normalize("  Dietética ")).toBe("dietetica");
  });

  it("busca por rubro, nombre y tono sin tildes", () => {
    expect(matchesQuery(A, "joyeria")).toBe(true);
    expect(matchesQuery(C, "neon")).toBe(true);
    expect(matchesQuery(B, "calido")).toBe(true);
    expect(matchesQuery(B, "gaming")).toBe(false);
  });

  it("entiende cómo lo dice el dueño (alias)", () => {
    expect(matchesQuery(A, "ropa")).toBe(true);
    expect(matchesQuery(C, "zapatillas")).toBe(true);
  });

  it("exige todas las palabras", () => {
    expect(matchesQuery(A, "moda joyas")).toBe(true);
    expect(matchesQuery(A, "moda gaming")).toBe(false);
  });

  it("combina búsqueda, fondo y plan", () => {
    expect(filterPresets(LIST, EMPTY_PRESET_FILTER, deps)).toEqual(LIST);
    expect(filterPresets(LIST, { ...EMPTY_PRESET_FILTER, tone: "dark" }, deps)).toEqual([C]);
    expect(filterPresets(LIST, { ...EMPTY_PRESET_FILTER, tone: "light" }, deps)).toEqual([A, B]);
    expect(filterPresets(LIST, { ...EMPTY_PRESET_FILTER, onlyAllowed: true }, deps)).toEqual([B, C]);
  });
});
