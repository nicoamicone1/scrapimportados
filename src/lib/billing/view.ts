import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

import { billingEnabled } from "./mercadopago";

/*
 * Lo que necesita la pantalla Plan para ofrecer MercadoPago. Tolerante: si la
 * migración 0015 no está aplicada (faltan columnas) o falla la lectura,
 * devuelve null y la pantalla sigue sólo con WhatsApp.
 */

export type BillingState = "none" | "pending" | "active" | "cancelling" | "past_due" | "cancelled";

export interface BillingView {
  /** Hay MP_ACCESS_TOKEN y la base tiene las columnas nuevas. */
  enabled: boolean;
  /** Planes con `mp_plan_id` cargado (se pueden pagar con MP). */
  payablePlans: string[];
  provider: string | null;
  providerRef: string | null;
  providerStatus: string | null;
  providerPlanCode: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentAt: string | null;
  currentPeriodEnd: string | null;
  state: BillingState;
}

/** Estado de MP para mostrar (puro). */
export function billingState(sub: {
  provider: string | null;
  provider_status: string | null;
  status: string;
  cancel_at_period_end: boolean;
}): BillingState {
  if (sub.provider !== "mercadopago" || !sub.provider_status) return "none";
  if (sub.provider_status === "pending") return "pending";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "active" && sub.cancel_at_period_end) return "cancelling";
  if (sub.status === "active" && sub.provider_status === "authorized") return "active";
  if (sub.status === "cancelled") return "cancelled";
  return "none";
}

export async function loadBillingView(supabase: ServerSupabase, storeId: string): Promise<BillingView | null> {
  try {
    const [plans, sub] = await Promise.all([
      supabase.from("plans").select("code, mp_plan_id").eq("is_public", true),
      supabase
        .from("subscriptions")
        .select("status, provider, provider_ref, provider_status, provider_plan_code, cancel_at_period_end, last_payment_at, current_period_end")
        .eq("store_id", storeId)
        .maybeSingle(),
    ]);
    if (plans.error || sub.error) return null;
    const s = sub.data;
    return {
      enabled: billingEnabled(),
      payablePlans: (plans.data ?? []).filter((p) => Boolean(p.mp_plan_id)).map((p) => p.code),
      provider: s?.provider ?? null,
      providerRef: s?.provider_ref ?? null,
      providerStatus: s?.provider_status ?? null,
      providerPlanCode: s?.provider_plan_code ?? null,
      cancelAtPeriodEnd: Boolean(s?.cancel_at_period_end),
      lastPaymentAt: s?.last_payment_at ?? null,
      currentPeriodEnd: s?.current_period_end ?? null,
      state: s ? billingState(s) : "none",
    };
  } catch {
    return null;
  }
}
