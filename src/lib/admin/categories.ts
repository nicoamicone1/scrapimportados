import "server-only";

import { requireAdmin } from "@/lib/auth";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Lecturas de categorías del admin.
 */

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  position: number;
  is_visible: boolean;
  seo: { title: string; description: string };
  product_count: number;
}

function parseSeo(value: Json): { title: string; description: string } {
  const o = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    title: typeof o.title === "string" ? o.title : "",
    description: typeof o.description === "string" ? o.description : "",
  };
}

/** Todas las categorías (con cantidad de productos), sin orden de árbol. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, image_url, parent_id, position, is_visible, seo, product_categories(count)")
    .eq("store_id", store.id)
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => {
    const counts = c.product_categories as unknown as { count: number }[] | null;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image_url: c.image_url,
      parent_id: c.parent_id,
      position: c.position,
      is_visible: c.is_visible,
      seo: parseSeo(c.seo),
      product_count: counts?.[0]?.count ?? 0,
    };
  });
}

/** Versión liviana para selects y árboles de checkboxes. */
export interface CategoryOption {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, parent_id, position")
    .eq("store_id", store.id)
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
