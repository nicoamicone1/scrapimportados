import "server-only";

import { createPublicClient } from "@/lib/supabase/server";

import { isMissingSchemaError } from "./checkout-sessions";

/**
 * ¿El checkout ofrece "Avisame por mail si dejo el pedido sin terminar"?
 * Tienda activa + Configuración › Pagos y checkout prendido + plan con
 * `marketing.abandoned` (RPC `checkout_reminders_enabled`, migración 0020).
 * Sin la migración, o ante cualquier error: false (el checkout sigue igual).
 */
export async function checkoutRemindersEnabled(storeId: string, configured: boolean): Promise<boolean> {
  if (!configured) return false;
  try {
    const { data, error } = await createPublicClient().rpc("checkout_reminders_enabled", { p_store_id: storeId });
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[carritos] habilitado:", error.code, error.message);
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}
