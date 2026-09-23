import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

export interface StorePaymentMethod {
  id: string;
  code: string;
  name: string;
  type: "transfer" | "whatsapp" | "cash" | "other";
  discountPercent: number;
  instructionsMd: string | null;
  position: number;
}

/** Lectura SIN cache (checkout: precios/costos tienen que ser los actuales). */
export async function fetchPaymentMethodsFresh(storeId: string): Promise<StorePaymentMethod[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, code, name, type, discount_percent, instructions_md, position")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("position");
  if (error) throw new Error(`No se pudieron leer los métodos de pago: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    type: (["transfer", "whatsapp", "cash"].includes(m.type) ? m.type : "other") as StorePaymentMethod["type"],
    discountPercent: Number(m.discount_percent),
    instructionsMd: m.instructions_md,
    position: m.position,
  }));
}

/** Métodos de pago activos. Tag: `payment-methods:<storeId>`. */
export function getPaymentMethods(storeId: string): Promise<StorePaymentMethod[]> {
  return unstable_cache(() => fetchPaymentMethodsFresh(storeId), ["store-payment-methods", storeId], {
    tags: [tagFor("payment-methods", storeId)],
    revalidate: CACHE_REVALIDATE,
  })();
}

/** Mayor % de descuento de transferencia (para la línea "con transferencia" de las cards). */
export async function getTransferDiscountPercent(storeId: string): Promise<number> {
  const methods = await getPaymentMethods(storeId);
  return methods.filter((m) => m.type === "transfer").reduce((max, m) => Math.max(max, m.discountPercent), 0);
}
