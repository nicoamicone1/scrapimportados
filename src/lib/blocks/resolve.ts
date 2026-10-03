import "server-only";

import type { Promotion } from "@/lib/pricing";
import { listCategories } from "@/lib/store/categories";
import { storeHasModule } from "@/lib/store/modules";
import { getCatalogIndex, getProductCards, type ProductCardData } from "@/lib/store/products";

import type { Block } from "./schema";
import { blockProductSource, selectCategories, selectProductIds, type CategoryTile } from "./select";

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
  /** blockId → productos (product_slider / product_grid / lookbook / hero con productos). */
  products: Record<string, ProductCardData[]>;
  /** blockId → categorías (category_list). */
  categories: Record<string, CategoryTile[]>;
  /** ¿La tienda tiene la app Taller 3D activa? (sólo se consulta si hay un `print3d_cta`; sin dato = no se muestra). */
  print3d?: boolean;
}

export const EMPTY_BLOCK_DATA: ResolvedBlockData = { products: {}, categories: {} };

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
  const productBlocks = visible.flatMap((b) => {
    const source = blockProductSource(b);
    return source ? [{ id: b.id, source }] : [];
  });
  const categoryBlocks = visible.filter((b): b is Extract<Block, { type: "category_list" }> => b.type === "category_list");
  // Bloques de apps: se muestran sólo con la app activa (si se desactivó, desaparecen solos).
  const print3d = visible.some((b) => b.type === "print3d_cta") ? await storeHasModule(storeId, "print3d") : undefined;
  if (!productBlocks.length && !categoryBlocks.length) return { products: {}, categories: {}, print3d };

  const [index, categories] = await Promise.all([getCatalogIndex(storeId), listCategories(storeId)]);
  const opts = { categories, promotions, now };

  const products = Object.fromEntries(
    await Promise.all(
      productBlocks.map(async (b) => [b.id, await getProductCards(storeId, selectProductIds(b.source, index, opts))] as const),
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

  return { products, categories: Object.fromEntries(categoryEntries), print3d };
}
