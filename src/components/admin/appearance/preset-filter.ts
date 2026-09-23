import type { PresetMeta } from "@/lib/theme";

/*
 * Filtro del selector de presets (apariencia): búsqueda libre por rubro,
 * nombre, tono o descripción + claro/oscuro + "sólo los de mi plan".
 * Trabaja sobre `PRESET_LIST` como datos: no conoce ids ni cantidad.
 */

export type PresetTone = "all" | "light" | "dark";

export interface PresetFilter {
  query: string;
  tone: PresetTone;
  /** Sólo los que el plan permite guardar. */
  onlyAllowed: boolean;
}

export const EMPTY_PRESET_FILTER: PresetFilter = { query: "", tone: "all", onlyAllowed: false };

/** Minúsculas y sin tildes: "Dietética" ≈ "dietetica". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/*
 * Cómo lo dice el dueño de la tienda → cómo aparece en los rubros de los
 * presets. Sólo amplía la búsqueda (nunca la restringe) y no nombra presets.
 */
const ALIASES: Record<string, string[]> = {
  ropa: ["moda", "indumentaria", "streetwear"],
  indumentaria: ["moda", "streetwear"],
  zapatillas: ["sneakers", "calzado"],
  calzado: ["sneakers", "zapatillas"],
  joyas: ["joyeria"],
  accesorios: ["joyeria", "marroquineria", "perifericos"],
  cuero: ["marroquineria"],
  tecnologia: ["electro", "perifericos", "importadoras"],
  celulares: ["electro", "importadoras"],
  electronica: ["electro"],
  muebles: ["deco", "hogar"],
  decoracion: ["deco", "hogar"],
  bazar: ["hogar", "deco"],
  herramientas: ["ferreteria"],
  comida: ["dietetica", "almacen", "gastronomia"],
  almacen: ["dietetica"],
  bebidas: ["vinos"],
  juegos: ["gaming"],
  libros: ["editoriales"],
  bicis: ["bicicletas"],
};

function haystack(meta: PresetMeta): string {
  return normalize([meta.name, meta.mood, meta.description, ...meta.industries].join(" "));
}

/** ¿El preset coincide con la búsqueda? Todas las palabras tienen que aparecer (o un alias). */
export function matchesQuery(meta: PresetMeta, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = haystack(meta);
  return words.every((w) => text.includes(w) || (ALIASES[w] ?? []).some((alias) => text.includes(alias)));
}

export function filterPresets<T extends PresetMeta>(
  list: readonly T[],
  filter: PresetFilter,
  { isDark, isAllowed }: { isDark: (id: T["id"]) => boolean; isAllowed: (id: T["id"]) => boolean },
): T[] {
  return list.filter(
    (p) =>
      matchesQuery(p, filter.query) &&
      (filter.tone === "all" || (filter.tone === "dark") === isDark(p.id)) &&
      (!filter.onlyAllowed || isAllowed(p.id)),
  );
}
