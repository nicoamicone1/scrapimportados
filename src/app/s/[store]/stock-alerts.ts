"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

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
 *
 * Anti-abuso además de los cupos del RPC: un honeypot (`website`, campo oculto
 * de la ficha: si viene con algo se responde "listo" sin anotar nada) y un
 * cupo por IP (20 por tienda y día) con un hash de la IP que calcula esta
 * action: sha256 de día + tienda + IP, truncado. No se guarda la IP, y el hash
 * cambia cada día (el equipo de la tienda no lo ve: 0016 no le da esa columna).
 */

/** Primera IP de `x-forwarded-for` (la pone Vercel) o `x-real-ip`. */
async function clientIpHash(storeId: string): Promise<string | undefined> {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
    if (!ip) return undefined;
    const day = new Date().toISOString().slice(0, 10);
    return createHash("sha256").update(`stock-alert|${day}|${storeId}|${ip}`).digest("hex").slice(0, 32);
  } catch {
    return undefined;
  }
}

export async function subscribeStockAlert(input: unknown): Promise<ActionResult<{ email: string; duplicate: boolean }>> {
  const parsed = stockAlertInputSchema.safeParse(input);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "email");
    return emailIssue ? fail(STOCK_ALERT_EMAIL_ERROR, { email: [STOCK_ALERT_EMAIL_ERROR] }) : fail(STOCK_ALERT_UNAVAILABLE);
  }
  try {
    const store = (await getTenant()).store;
    if (!store) return fail("Esta tienda no está disponible en este momento.");
    const { productId, variantId, email, website } = parsed.data;
    // Honeypot: un bot que completa todo recibe la misma respuesta que una persona.
    if (website?.trim()) return ok({ email, duplicate: false });
    const { data, error } = await createPublicClient().rpc("create_stock_alert", {
      p_store_id: store.id,
      p_variant_id: variantId,
      p_email: email,
      p_product_id: productId,
      p_ip_hash: await clientIpHash(store.id),
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
