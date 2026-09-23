import "server-only";

import type { Promotion } from "@/lib/pricing";
import { listCategories } from "@/lib/store/categories";
import { getCatalogIndex, getProductCards, type ProductCardData } from "@/lib/store/products";

import type { Block, ProductSource } from "./schema";
import { selectCategories, selectProductIds, MAX_BLOCK_PRODUCTS, type CategoryTile } from "./select";

export type { CategoryTile } from "./select";

/**
 * Datos que necesitan los bloques, resueltos en el server (agente E).
 * Contrato con el storefront (S): la página llama
 *   `const data = await resolveBlockData(store.id, page.blocks, promotions)`
 * y se lo pasa tal cual a `<BlockRenderer data={data} … />`.
 * Los `href` de las tiles son paths de la tienda SIN prefijo (`/categoria/x`):
 * el prefijo `/s/<slug>` lo agrega `StoreLink` al renderizar.
 */
export interface ResolvedBlockData {
  /** blockId → productos (product_slider / product_grid). */
  products: Record<string, ProductCardData[]>;
  /** blockId → categorías (category_list). */
  categories: Record<string, CategoryTile[]>;
}

export const EMPTY_BLOCK_DATA: ResolvedBlockData = { products: {}, categories: {} };

/** Fuente efectiva: en la grilla, `rows × columns` pisa el límite. */
function effectiveSource(block: Extract<Block, { type: "product_slider" | "product_grid" }>): ProductSource {
  const source = block.settings.source;
  if (block.type === "product_grid" && block.settings.rows && source.kind !== "manual") {
    return { ...source, limit: Math.min(block.settings.rows * block.settings.columns, MAX_BLOCK_PRODUCTS) };
  }
  return source;
}

export interface ResolveOptions {
  /** Incluir bloques ocultos (preview del builder). */
  includeHidden?: boolean;
  now?: Date;
}

export async function resolveBlockData(
  storeId: string,
  blocks: Block[],
  promotions: Promotion[],
  { includeHidden = false, now = new Date() }: ResolveOptions = {},
): Promise<ResolvedBlockData> {
  const visible = includeHidden ? blocks : blocks.filter((b) => !b.style.hidden);
  const productBlocks = visible.filter(
    (b): b is Extract<Block, { type: "product_slider" | "product_grid" }> =>
      b.type === "product_slider" || b.type === "product_grid",
  );
  const categoryBlocks = visible.filter((b): b is Extract<Block, { type: "category_list" }> => b.type === "category_list");
  if (!productBlocks.length && !categoryBlocks.length) return { products: {}, categories: {} };

  const [index, categories] = await Promise.all([getCatalogIndex(storeId), listCategories(storeId)]);
  const opts = { categories, promotions, now };

  const products = Object.fromEntries(
    await Promise.all(
      productBlocks.map(async (b) => [b.id, await getProductCards(storeId, selectProductIds(effectiveSource(b), index, opts))] as const),
    ),
  );

  const categoryEntries = await Promise.all(
    categoryBlocks.map(async (b) => {
      const picks = selectCategories(b.settings.categoryIds, categories, index);
      const coverIds = picks.filter((p) => !p.category.imageUrl).flatMap((p) => p.coverCandidates);
      const cards = new Map((await getProductCards(storeId, coverIds)).map((p) => [p.id, p.image?.url ?? null]));
      const coverFor = (ids: string[]) => ids.map((id) => cards.get(id)).find((url): url is string => !!url) ?? null;
      const tiles: CategoryTile[] = picks.map((p) => ({
        id: p.category.id,
        name: p.category.name,
        slug: p.category.slug,
        href: `/categoria/${p.category.slug}`,
        imageUrl: p.category.imageUrl ?? coverFor(p.coverCandidates),
        imageFit: p.category.imageUrl ? "cover" : "contain",
        productCount: p.productCount,
      }));
      return [b.id, tiles] as const;
    }),
  );

  return { products, categories: Object.fromEntries(categoryEntries) };
}
