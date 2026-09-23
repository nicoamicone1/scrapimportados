"use server";

import { fail, ok, type ActionResult } from "@/lib/actions";
import { readStockAlertRpc, STOCK_ALERT_EMAIL_ERROR, STOCK_ALERT_UNAVAILABLE, stockAlertInputSchema } from "@/lib/admin/inventory-alerts-utils";
import { createPublicClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant/resolve";

/*
 * "Avisame cuando haya stock" (acción PÚBLICA del storefront, migración
 * 0016). La tienda sale del request, nunca del cliente; el RPC
 * `create_stock_alert` (security definer) valida que el producto sea de esa
 * tienda, que esté publicado y sin stock, y aplica los cupos.
 * Sin la migración aplicada responde "No pudimos anotarte".
 */

export async function subscribeStockAlert(input: unknown): Promise<ActionResult<{ email: string; duplicate: boolean }>> {
  const parsed = stockAlertInputSchema.safeParse(input);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "email");
    return emailIssue ? fail(STOCK_ALERT_EMAIL_ERROR, { email: [STOCK_ALERT_EMAIL_ERROR] }) : fail(STOCK_ALERT_UNAVAILABLE);
  }
  try {
    const store = (await getTenant()).store;
    if (!store) return fail("Esta tienda no está disponible en este momento.");
    const { productId, variantId, email } = parsed.data;
    const { data, error } = await createPublicClient().rpc("create_stock_alert", {
      p_store_id: store.id,
      p_variant_id: variantId,
      p_email: email,
      p_product_id: productId,
    });
    if (error && error.code !== "P0001") console.error("[avisos de stock]", error.code, error.message);
    const r = readStockAlertRpc(data, error);
    if (!r.ok) return r.error === STOCK_ALERT_EMAIL_ERROR ? fail(r.error, { email: [r.error] }) : fail(r.error);
    return ok({ email, duplicate: r.duplicate });
  } catch (err) {
    console.error(err);
    return fail(STOCK_ALERT_UNAVAILABLE);
  }
}
