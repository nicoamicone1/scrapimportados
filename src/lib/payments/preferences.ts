import "server-only";

import { mpRequest } from "@/lib/billing/mercadopago";
import { platformOrigin } from "@/lib/tenant/urls";

import type { BillingDb } from "@/lib/billing/service";

import type { SellerAccount } from "./accounts";
import { buildPreferenceBody, isMercadoPagoCheckoutUrl, type PreferenceInput } from "./preference-body";

/*
 * Preferencia de Checkout Pro con el token del comercio (docs/PAYMENTS.md §4).
 * El cuerpo se arma en preference-body.ts (puro, con tests).
 */

export interface MpPreference {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

export function webhookUrl(storeId: string): string {
  return `${platformOrigin()}/api/payments/mercadopago/webhook?store=${encodeURIComponent(storeId)}`;
}

export async function createOrderPreference(
  db: BillingDb,
  account: SellerAccount,
  input: Omit<PreferenceInput, "notificationUrl">,
): Promise<{ preferenceId: string; url: string }> {
  const body = buildPreferenceBody({ ...input, notificationUrl: webhookUrl(account.storeId) });
  const pref = await mpRequest<MpPreference>("/checkout/preferences", {
    method: "POST",
    body,
    token: account.accessToken,
    idempotencyKey: `ecommy-pref-${input.order.id}-${Date.now()}`,
  });
  const url = pref.init_point ?? pref.sandbox_init_point ?? "";
  if (!pref.id || !isMercadoPagoCheckoutUrl(url)) throw new Error("Mercado Pago devolvió un link de pago inesperado.");
  const { error } = await db
    .from("orders")
    .update({ payment_provider: "mercadopago", payment_provider_ref: pref.id })
    .eq("id", input.order.id)
    .eq("store_id", account.storeId);
  if (error) console.error("[payments] guardar preferencia", error.message);
  return { preferenceId: pref.id, url };
}
