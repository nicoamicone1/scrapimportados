import type { CatalogItem } from "./products";

/**
 * Sliders horizontales de la portada. Para agregar uno nuevo, sumar un objeto
 * a `HOME_SLIDERS`: `slugs` son categorías exactas y `slugPrefix` toma todas
 * las que empiecen con ese prefijo (ej. todas las de auriculares).
 */
export interface HomeSlider {
  title: string;
  slugs?: string[];
  slugPrefix?: string;
  /** Link del "Ver todos →". */
  href: string;
  /** Máximo de productos en el slider. */
  max?: number;
}

export const HOME_SLIDERS: HomeSlider[] = [
  {
    title: "Parlantes",
    // Ojo: en los datos del proveedor el slug es `parlantes-general`.
    slugs: ["parlantes-general"],
    href: "/productos/?cat=parlantes-general",
  },
  {
    title: "Auriculares",
    // auricular-bluetooth + auricular-con-cable + auricular-vincha
    slugPrefix: "auricular",
    href: "/productos/?q=auricular",
  },
  {
    title: "Smartwatch",
    slugs: ["smartwatch"],
    href: "/productos/?cat=smartwatch",
  },
];

const DEFAULT_MAX = 12;

/** Productos con stock que caen en las categorías del slider. */
export function itemsForSlider(
  items: CatalogItem[],
  slider: HomeSlider,
): CatalogItem[] {
  const exact = new Set(slider.slugs ?? []);
  const prefix = slider.slugPrefix;

  return items
    .filter(
      (p) =>
        p.inStock &&
        p.categories.some(
          (c) =>
            exact.has(c.slug) || (prefix ? c.slug.startsWith(prefix) : false),
        ),
    )
    .slice(0, slider.max ?? DEFAULT_MAX);
}
