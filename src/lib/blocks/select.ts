import { isPromotionEligible, type Promotion } from "@/lib/pricing";

import type { ProductSource } from "./schema";

/*
 * Selección PURA de productos y categorías para los bloques del builder
 * (agente E). `resolve.ts` (server-only) le pasa el índice cacheado del
 * catálogo y las categorías; acá no hay I/O, así que se testea con vitest.
 */

/** Lo mínimo del índice del catálogo (`CatalogIndexItem` de `lib/store/products`). */
export interface SelectableProduct {
  id: string;
  categoryIds: string[];
  hasCompareAt: boolean;
  available: boolean;
  featured: boolean;
  tags: string[];
  createdAt: string;
}

export interface SelectableCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
}

export interface SelectOptions {
  categories: SelectableCategory[];
  promotions: Promotion[];
  now?: Date;
}

export const MAX_BLOCK_PRODUCTS = 48;

/** Ids de la categoría y todas sus descendientes (sin ciclos). */
export function categoryWithDescendants(categories: SelectableCategory[], rootId: string): Set<string> {
  const out = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const c of categories) {
      if (c.parentId === current && !out.has(c.id)) {
        out.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return out;
}

/** Con stock primero, conservando el orden relativo (sort estable). */
function availableFirst<T extends { available: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.available) - Number(a.available));
}

function byNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** ¿El producto está en oferta? Precio tachado propio o una promo vigente que lo alcanza. */
export function isOnSale(p: SelectableProduct, promotions: Promotion[], now = new Date()): boolean {
  if (p.hasCompareAt) return true;
  return promotions.some((promo) => isPromotionEligible(promo, { id: p.id, categoryIds: p.categoryIds }, now));
}

/**
 * Ids de productos para una fuente de bloque, ya ordenados y limitados.
 * - `manual`: respeta el orden elegido, descarta los que no están activos.
 * - resto: primero los que tienen stock (DESIGN.md §6.1), después los agotados.
 */
export function selectProductIds(
  source: ProductSource,
  index: SelectableProduct[],
  { categories, promotions, now = new Date() }: SelectOptions,
): string[] {
  if (source.kind === "manual") {
    const active = new Set(index.map((p) => p.id));
    const seen = new Set<string>();
    return source.productIds
      .filter((id) => {
        if (!active.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, MAX_BLOCK_PRODUCTS);
  }

  const limit = Math.min(Math.max(source.limit, 1), MAX_BLOCK_PRODUCTS);
  let pool: SelectableProduct[];
  switch (source.kind) {
    case "category": {
      const ids = categoryWithDescendants(categories, source.categoryId);
      pool = byNewest(index.filter((p) => p.categoryIds.some((c) => ids.has(c))));
      break;
    }
    case "tag": {
      const tag = source.tag.trim().toLowerCase();
      pool = byNewest(index.filter((p) => p.tags.some((t) => t.trim().toLowerCase() === tag)));
      break;
    }
    case "newest":
      pool = byNewest(index);
      break;
    case "featured":
      pool = byNewest(index.filter((p) => p.featured));
      break;
    case "on_sale":
      pool = byNewest(index.filter((p) => isOnSale(p, promotions, now)));
      break;
  }
  return availableFirst(pool)
    .slice(0, limit)
    .map((p) => p.id);
}

/** Tile de categoría ya resuelto para el bloque `category_list`. */
export interface CategoryTile {
  id: string;
  name: string;
  slug: string;
  href: string;
  /** Imagen propia de la categoría o, si no tiene, la del primer producto con stock. */
  imageUrl: string | null;
  /** `cover` para la foto propia de la categoría; `contain` para la foto (recortada) de un producto. */
  imageFit: "cover" | "contain";
  productCount: number;
}

export interface CategoryPick {
  category: SelectableCategory;
  productCount: number;
  /** Producto del que tomar la foto si la categoría no tiene imagen. */
  coverProductId: string | null;
  /** Primeros productos (con stock primero) por si el primero no tiene foto. */
  coverCandidates: string[];
}

/**
 * Categorías para `category_list`. `'all'` = categorías raíz con productos,
 * en su orden; una lista explícita respeta el orden elegido. Cuenta productos
 * incluyendo subcategorías.
 */
export function selectCategories(
  categoryIds: string[] | "all",
  categories: SelectableCategory[],
  index: SelectableProduct[],
): CategoryPick[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const chosen =
    categoryIds === "all"
      ? [...categories].filter((c) => !c.parentId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "es"))
      : categoryIds.map((id) => byId.get(id)).filter((c): c is SelectableCategory => !!c);

  const picks = chosen.map((category) => {
    const ids = categoryWithDescendants(categories, category.id);
    const products = availableFirst(index.filter((p) => p.categoryIds.some((c) => ids.has(c))));
    return {
      category,
      productCount: products.length,
      coverProductId: products[0]?.id ?? null,
      coverCandidates: products.slice(0, 4).map((p) => p.id),
    };
  });
  return categoryIds === "all" ? picks.filter((p) => p.productCount > 0) : picks;
}
