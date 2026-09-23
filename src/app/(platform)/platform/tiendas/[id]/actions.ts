"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setStorePlan } from "@/app/(platform)/platform/actions";
import { fail, ok, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { billingEnabled, MercadoPagoError } from "@/lib/billing/mercadopago";
import { billingServiceClient } from "@/lib/billing/service";
import { describeResult, supabaseBillingRepo, syncPreapproval } from "@/lib/billing/sync";
import { BILLING_PERIODS, type BillingPeriod } from "@/lib/plans/yearly";

/**
 * Cambio manual de plan con periodicidad (0019). El cambio en sí (y la
 * cancelación del débito de MercadoPago, si hay) lo hace `setStorePlan`, que
 * guarda mensual; si el superadmin eligió anual (pago del año por
 * transferencia), después se marca anual con `platform_set_plan(…,
 * p_billing_period => 'yearly')`. La prueba y Free son siempre mensuales.
 */
export async function setStorePlanWithPeriod(
  input: Parameters<typeof setStorePlan>[0] & { period?: BillingPeriod },
): Promise<ActionResult> {
  const { period: rawPeriod, ...rest } = input;
  const period = z.enum(BILLING_PERIODS).catch("monthly").parse(rawPeriod ?? "monthly");
  const res = await setStorePlan(rest);
  if (!res.ok || period === "monthly" || rest.status === "trialing" || rest.plan === "free") return res;
  return runAction(async () => {
    const { supabase, user } = await requirePlatformAdmin();
    const { error } = await supabase.rpc("platform_set_plan", {
      p_store_id: rest.storeId,
      p_plan_code: rest.plan,
      p_status: rest.status,
      p_billing_period: "yearly",
    });
    if (error) return fail(`Guardamos el plan como mensual, pero no pudimos marcarlo anual: ${error.message}`);
    const { error: auditError } = await supabase.from("audit_log").insert({
      store_id: rest.storeId,
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "platform.plan",
      entity: "store",
      entity_id: rest.storeId,
      summary: `Superadmin: plan ${rest.plan} con pago anual`,
    });
    if (auditError) console.error("[audit]", auditError.message);
    revalidatePath(`/platform/tiendas/${rest.storeId}`);
    return ok();
  });
}

/**
 * "Sincronizar con MercadoPago" (superadmin): relee el preapproval de la
 * tienda en MP y aplica el estado con `billing_apply_subscription`, igual que
 * el webhook (sirve si un aviso se perdió o para verificar el estado).
 */
export async function syncStoreBilling(input: { storeId: string }): Promise<ActionResult<{ summary: string }>> {
  return runAction(async () => {
    const { supabase, user } = await requirePlatformAdmin();
    const parsed = z.object({ storeId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { storeId } = parsed.data;
    if (!billingEnabled()) return fail("Falta MP_ACCESS_TOKEN: el cobro con MercadoPago está apagado.");
    const db = billingServiceClient();
    if (!db) return fail("Falta SUPABASE_SERVICE_ROLE_KEY: no se puede aplicar el estado de MercadoPago.");

    const { data: sub, error } = await supabase.from("subscriptions").select("provider, provider_ref").eq("store_id", storeId).maybeSingle();
    if (error) return fail(error.message);
    if (!sub?.provider_ref) return fail("La tienda no tiene una suscripción de MercadoPago.");

    let summary: string;
    try {
      const result = await syncPreapproval(sub.provider_ref, { expectedStoreId: storeId }, { repo: supabaseBillingRepo(db) });
      summary = describeResult(result);
    } catch (err) {
      if (err instanceof MercadoPagoError) {
        console.error("[billing]", err.message);
        return fail(err.status === 404 ? "MercadoPago no encuentra esa suscripción." : "MercadoPago no respondió. Probá de nuevo en unos minutos.");
      }
      throw err;
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      store_id: storeId,
      actor_id: user.id,
      actor_email: user.email ?? null,
      action: "platform.billing_sync",
      entity: "subscription",
      entity_id: storeId,
      summary: `Superadmin: sincronizó MercadoPago. ${summary}`,
    });
    if (auditError) console.error("[audit]", auditError.message);
    revalidatePath(`/platform/tiendas/${storeId}`);
    return ok({ summary });
  });
}
