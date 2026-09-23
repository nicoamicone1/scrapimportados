import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

import { asObject, asString, CACHE_REVALIDATE } from "./utils";

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  seo: { title: string; description: string };
  updatedAt: string;
}

/** Categorías visibles, ordenadas. Tag: `categories:<storeId>`. */
export function listCategories(storeId: string): Promise<StoreCategory[]> {
  return unstable_cache(
    async (): Promise<StoreCategory[]> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, image_url, parent_id, position, seo, updated_at")
        .eq("store_id", storeId)
        .eq("is_visible", true)
        .order("position")
        .order("name");
      if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
      return (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.image_url,
        parentId: c.parent_id,
        position: c.position,
        seo: { title: asString(asObject(c.seo).title), description: asString(asObject(c.seo).description) },
        updatedAt: c.updated_at,
      }));
    },
    ["store-categories-v2", storeId],
    { tags: [tagFor("categories", storeId)], revalidate: CACHE_REVALIDATE },
  )();
}

export async function getCategoryBySlug(storeId: string, slug: string): Promise<StoreCategory | null> {
  return (await listCategories(storeId)).find((c) => c.slug === slug) ?? null;
}

/** Ids de la categoría y todas sus descendientes. */
export function descendantIds(categories: StoreCategory[], rootId: string): string[] {
  const out = [rootId];
  for (let i = 0; i < out.length; i++) {
    for (const c of categories) if (c.parentId === out[i] && !out.includes(c.id)) out.push(c.id);
  }
  return out;
}

/** Árbol de categorías (raíces con `children`). */
export interface CategoryNode extends StoreCategory {
  children: CategoryNode[];
}

export function buildCategoryTree(categories: StoreCategory[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(categories.map((c) => [c.id, { ...c, children: [] }]));
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
