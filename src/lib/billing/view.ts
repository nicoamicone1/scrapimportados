import "server-only";

import { isBillingPeriod, validYearly, type BillingPeriod } from "@/lib/plans/yearly";
import type { ServerSupabase } from "@/lib/supabase/server";

import { billingEnabled } from "./mercadopago";
import { AUTHORIZED_UNPAID } from "./state";

/*
 * Lo que necesita la pantalla Plan para ofrecer MercadoPago. Tolerante: si la
 * migración 0015 no está aplicada (faltan columnas) o falla la lectura,
 * devuelve null y la pantalla sigue sólo con WhatsApp. Sin 0019 no hay pago
 * anual (`payableYearly` vacío) y todo es mensual.
 */

export type BillingState = "none" | "pending" | "active" | "cancelling" | "past_due" | "cancelled";

export interface BillingView {
  /** Hay MP_ACCESS_TOKEN y la base tiene las columnas nuevas. */
  enabled: boolean;
  /** Planes con `mp_plan_id` cargado (se pueden pagar con MP, por mes). */
  payablePlans: string[];
  /** Planes con `price_yearly` (0019): se pueden pagar el año con MP, con o sin `mp_plan_id_yearly`. */
  payableYearly: string[];
  /** Periodicidad del plan vigente (0019). */
  billingPeriod: BillingPeriod;
  /** Periodicidad del checkout de MP en curso / aplicado (0019). */
  providerBillingPeriod: BillingPeriod | null;
  provider: string | null;
  providerRef: string | null;
  providerStatus: string | null;
  providerPlanCode: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentAt: string | null;
  currentPeriodEnd: string | null;
  state: BillingState;
}

/**
 * Estado de MP para mostrar (puro). Una tienda que ya volvió a Free (renovación
 * vencida, sin cobro) no muestra la suscripción de MP como vigente, salvo un
 * checkout pendiente. "active" incluye la gracia sin primer cobro
 * (`authorized_unpaid`): el débito automático está autorizado igual.
 */
export function billingState(sub: {
  plan_code: string;
  provider: string | null;
  provider_status: string | null;
  status: string;
  cancel_at_period_end: boolean;
}): BillingState {
  if (sub.provider !== "mercadopago" || !sub.provider_status) return "none";
  if (sub.provider_status === "pending") return "pending";
  if (sub.plan_code === "free") return "none";
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "active" && sub.cancel_at_period_end) return "cancelling";
  if (sub.status === "active" && (sub.provider_status === "authorized" || sub.provider_status === AUTHORIZED_UNPAID)) return "active";
  if (sub.status === "cancelled") return "cancelled";
  return "none";
}

const SUB_COLUMNS = "plan_code, status, provider, provider_ref, provider_status, provider_plan_code, cancel_at_period_end, last_payment_at, current_period_end";

/** Planes y suscripción con las columnas del anual (0019); `null` si la base todavía no las tiene. */
async function loadYearly(supabase: ServerSupabase, storeId: string) {
  const [plans, sub] = await Promise.all([
    supabase.from("plans").select("code, mp_plan_id, price_yearly").eq("is_public", true),
    supabase
      .from("subscriptions")
      .select(
        "plan_code, status, provider, provider_ref, provider_status, provider_plan_code, cancel_at_period_end, last_payment_at, current_period_end, billing_period, provider_billing_period",
      )
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);
  if (plans.error || sub.error) return null;
  return { plans: plans.data ?? [], sub: sub.data };
}

export async function loadBillingView(supabase: ServerSupabase, storeId: string): Promise<BillingView | null> {
  try {
    const yearly = await loadYearly(supabase, storeId);
    const legacy = yearly
      ? null
      : await Promise.all([
          supabase.from("plans").select("code, mp_plan_id").eq("is_public", true),
          supabase.from("subscriptions").select(SUB_COLUMNS).eq("store_id", storeId).maybeSingle(),
        ]);
    if (legacy && (legacy[0].error || legacy[1].error)) return null;
    const plans: { code: string; mp_plan_id: string | null; price_yearly?: number | null }[] = yearly?.plans ?? legacy?.[0].data ?? [];
    const s = yearly ? yearly.sub : (legacy?.[1].data ?? null);
    const period = (v: unknown): BillingPeriod | null => (isBillingPeriod(v) ? v : null);
    return {
      enabled: billingEnabled(),
      payablePlans: plans.filter((p) => Boolean(p.mp_plan_id)).map((p) => p.code),
      payableYearly: plans.filter((p) => validYearly(Number(p.price_yearly ?? Number.NaN)) !== null).map((p) => p.code),
      billingPeriod: (s && "billing_period" in s ? period(s.billing_period) : null) ?? "monthly",
      providerBillingPeriod: s && "provider_billing_period" in s ? period(s.provider_billing_period) : null,
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
