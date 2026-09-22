import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";

/*
 * Tipos de las vistas y funciones de `0003_catalog.sql` (agente A).
 * `database.types.ts` se regenera fuera de este agente; hasta entonces el
 * catálogo usa este tipo extendido. Cuando se regeneren, `CatalogDatabase`
 * sigue siendo compatible (sólo agrega lo que falte).
 */

export type AdminProductRow = {
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
  public: Omit<PublicSchema, "Views" | "Functions"> & {
    Views: PublicSchema["Views"] & {
      admin_products: View<AdminProductRow>;
      admin_inventory: View<AdminInventoryRow>;
    };
    Functions: PublicSchema["Functions"] & {
      inventory_summary: { Args: never; Returns: Json };
      reorder_categories: { Args: { items: Json }; Returns: number };
    };
  };
};

export type CatalogClient = SupabaseClient<CatalogDatabase, "public">;

/** Mismo cliente (misma sesión y RLS), con los tipos del catálogo. */
export function catalogDb(client: { from: unknown; rpc: unknown }): CatalogClient {
  return client as unknown as CatalogClient;
}
