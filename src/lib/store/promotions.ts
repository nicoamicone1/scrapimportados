import "server-only";

import { unstable_cache } from "next/cache";

import { promotionFromRow, type Promotion } from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

/**
 * Promociones activas (la ventana de fechas la evalúa el motor en cada
 * render, así una promo que empieza a las 00:00 aplica sin revalidar).
 * Tag: `promotions`.
 */
/** Lectura SIN cache (checkout: precios/costos tienen que ser los actuales). */
export async function fetchActivePromotionsFresh(): Promise<Promotion[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, name, type, value, scope, category_ids, product_ids, starts_at, ends_at, is_active, priority, badge_label, stackable")
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (error) throw new Error(`No se pudieron leer las promociones: ${error.message}`);
  return (data ?? []).map(promotionFromRow);
}

export const getActivePromotions = unstable_cache(
  () => fetchActivePromotionsFresh(),
  ["store-promotions"],
  { tags: ["promotions"], revalidate: CACHE_REVALIDATE },
);
