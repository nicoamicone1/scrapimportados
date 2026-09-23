import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

/*
 * Tipos de las vistas del catálogo (`admin_products`, `admin_inventory`).
 * `database.types.ts` las genera con todas las columnas nullable (así tipa
 * PostgREST las vistas); acá se reemplazan por filas no nulas, que es lo que
 * garantizan las vistas. Las funciones (`inventory_summary(p_store_id)`,
 * `reorder_categories(p_store_id, items)`) vienen tal cual de los tipos
 * generados. Ambas vistas tienen `store_id`: filtrá siempre por la tienda.
 */

export type AdminProductRow = {
  store_id: string;
  id: string;
  name: string;
  slug: string;
  status: string;
  brand: string | null;
  source: string;
  source_url: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
  variant_count: number;
  min_price: number | null;
  max_price: number | null;
  total_stock: number;
  tracked: boolean;
  out_count: number;
  low_count: number;
  skus: string;
  first_variant_id: string | null;
  image_url: string | null;
  category_ids: string[];
  stock_state: "ok" | "low" | "out" | "untracked";
};

export type AdminInventoryRow = {
  store_id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_status: string;
  variant_title: string;
  sku: string | null;
  stock: number;
  cost: number | null;
  track_inventory: boolean;
  is_active: boolean;
  low_stock_threshold: number | null;
  threshold: number;
  position: number;
  updated_at: string;
  image_url: string | null;
  category_ids: string[];
  stock_state: "ok" | "low" | "out" | "untracked";
};

type View<Row> = { Row: Row; Relationships: [] };

type PublicSchema = Database["public"];

export type CatalogDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Views"> & {
    Views: Omit<PublicSchema["Views"], "admin_products" | "admin_inventory"> & {
      admin_products: View<AdminProductRow>;
      admin_inventory: View<AdminInventoryRow>;
    };
  };
};

export type CatalogClient = SupabaseClient<CatalogDatabase, "public">;

/** Mismo cliente (misma sesión y RLS), con los tipos del catálogo. */
export function catalogDb(client: { from: unknown; rpc: unknown }): CatalogClient {
  return client as unknown as CatalogClient;
}
