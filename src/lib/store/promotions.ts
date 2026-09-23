import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { promotionFromRow, type Promotion } from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

/**
 * Promociones activas (la ventana de fechas la evalúa el motor en cada
 * render, así una promo que empieza a las 00:00 aplica sin revalidar).
 * Tag: `promotions:<storeId>`.
 */
/** Lectura SIN cache (checkout: precios/costos tienen que ser los actuales). */
export async function fetchActivePromotionsFresh(storeId: string): Promise<Promotion[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, name, type, value, scope, category_ids, product_ids, starts_at, ends_at, is_active, priority, badge_label, stackable")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("priority", { ascending: false });
  if (error) throw new Error(`No se pudieron leer las promociones: ${error.message}`);
  return (data ?? []).map(promotionFromRow);
}

export function getActivePromotions(storeId: string): Promise<Promotion[]> {
  return unstable_cache(() => fetchActivePromotionsFresh(storeId), ["store-promotions", storeId], {
    tags: [tagFor("promotions", storeId)],
    revalidate: CACHE_REVALIDATE,
  })();
}
