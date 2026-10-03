import "server-only";

import { unstable_cache } from "next/cache";

import { tagFor } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

import { fetchSettingsFresh } from "./settings";
import { CACHE_REVALIDATE } from "./utils";

const TYPES = ["transfer", "whatsapp", "cash", "mercadopago"] as const;

export interface StorePaymentMethod {
  id: string;
  code: string;
  name: string;
  type: "transfer" | "whatsapp" | "cash" | "other" | "mercadopago";
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
  // El método de Mercado Pago sólo se ofrece con la cuenta conectada (0023).
  // Sin la migración la RPC no existe y el método tampoco.
  const rows = data ?? [];
  const online = rows.some((m) => m.type === "mercadopago") ? await storePaymentsOnline(storeId) : false;
  return rows.filter((m) => m.type !== "mercadopago" || online).map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    type: ((TYPES as readonly string[]).includes(m.type) ? m.type : "other") as StorePaymentMethod["type"],
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

async function storePaymentsOnline(storeId: string): Promise<boolean> {
  const { data, error } = await createPublicClient().rpc("store_payments_online", { p_store_id: storeId });
  if (error) {
    console.error("[payments] store_payments_online:", error.message);
    return false;
  }
  return data === true;
}

export interface OnlinePaymentInfo {
  /** ¿La tienda cobra con tarjeta (Mercado Pago conectado y activo)? */
  online: boolean;
  maxInstallments: number;
  /** Cuotas sin interés que el comercio declara ofrecer (0 = no se comunican). */
  freeInstallments: number;
}

export async function fetchOnlinePaymentInfo(storeId: string): Promise<OnlinePaymentInfo> {
  const [methods, settings] = await Promise.all([fetchPaymentMethodsFresh(storeId), fetchSettingsFresh(storeId)]);
  const online = methods.some((m) => m.type === "mercadopago");
  const mp = settings.checkout.mercadopago;
  return {
    online,
    maxInstallments: online ? mp.max_installments : 0,
    freeInstallments: online ? Math.min(mp.free_installments, mp.max_installments) : 0,
  };
}

/** Cuotas para las cards y la ficha. Tags: `payment-methods:<id>` y `settings:<id>`. */
export function getOnlinePaymentInfo(storeId: string): Promise<OnlinePaymentInfo> {
  return unstable_cache(() => fetchOnlinePaymentInfo(storeId), ["store-online-payments", storeId], {
    tags: [tagFor("payment-methods", storeId), tagFor("settings", storeId)],
    revalidate: CACHE_REVALIDATE,
  })();
}
