"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { startCheckout } from "@/lib/billing/checkout";
import { billingEnabled, cancelPreapproval, MercadoPagoError } from "@/lib/billing/mercadopago";
import { billingServiceClient } from "@/lib/billing/service";
import { describeResult, supabaseBillingRepo, syncPreapproval } from "@/lib/billing/sync";
import { notifyPlanRequest } from "@/lib/email/notify";
import { isEmail } from "@/lib/email/send";
import { PLAN_CODES, PLAN_NAMES, type PlanCode } from "@/lib/plans";
import { platformOrigin, storeDisplayHost } from "@/lib/tenant/urls";

/**
 * "Quiero este plan": registra el pedido en auditoría y devuelve el link de
 * WhatsApp de la plataforma con el mensaje armado. Convive con el cobro
 * automático por MercadoPago (más abajo; docs/BILLING.md).
 *
 * Sólo dueño o administrador: el staff no decide el plan (y cada pedido manda
 * un mail a la casilla de la plataforma).
 */
export async function requestUpgrade(input: { plan: string }): Promise<ActionResult<{ url: string | null }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return fail("Sólo el dueño o un administrador de la tienda puede pedir un cambio de plan.");
    }
    const parsed = z.object({ plan: z.enum(PLAN_CODES) }).safeParse(input);
    if (!parsed.success) return fail("Plan inválido.");
    const plan = parsed.data.plan as PlanCode;
    if (plan === ctx.plan.code) return fail("Ya estás en ese plan.");

    await logAudit(ctx, {
      action: "plan.upgrade_request",
      entity: "subscription",
      entityId: ctx.store.id,
      summary: `Pidió pasar de ${ctx.plan.name} a ${PLAN_NAMES[plan]}`,
      diff: { plan: [ctx.plan.code, plan] },
    });
    // Aviso interno a la plataforma (si hay PLATFORM_EMAIL), además del WhatsApp.
    notifyPlanRequest({
      store: ctx.store,
      currentPlan: ctx.plan.name,
      currentTrial: ctx.plan.status === "trialing",
      requestedPlanCode: plan,
      requestedPlan: PLAN_NAMES[plan],
      requestedBy: ctx.user.email,
    });

    const phone = (process.env.PLATFORM_WHATSAPP ?? "").replace(/\D/g, "");
    if (!phone) return ok<{ url: string | null }>({ url: null });
    const text = [
      `Hola! Quiero pasar mi tienda al plan ${PLAN_NAMES[plan]}.`,
      "",
      `Tienda: ${ctx.store.name} (${storeDisplayHost(ctx.store)})`,
      `Plan actual: ${ctx.plan.name}${ctx.plan.status === "trialing" ? " (prueba)" : ""}`,
      `Cuenta: ${ctx.user.email ?? ""}`,
    ].join("\n");
    return ok<{ url: string | null }>({ url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` });
  });
}

// ---------------------------------------------------------------------------
// MercadoPago Suscripciones (docs/BILLING.md)
// ---------------------------------------------------------------------------

/** Sólo el dueño con su propia cuenta (el mail de MP es el suyo; un superadmin "entrando como" no paga). */
function ownerOnly(ctx: AdminContext): string | null {
  if (ctx.membership.role !== "owner" || ctx.membership.impersonating) {
    return "Sólo el dueño de la tienda, con su cuenta, puede pagar o cancelar el plan.";
  }
  return null;
}

function mpErrorMessage(err: unknown): string | null {
  if (!(err instanceof MercadoPagoError)) return null;
  console.error("[billing]", err.message);
  return "MercadoPago no respondió como esperábamos. Probá de nuevo en unos minutos o pedí el plan por WhatsApp.";
}

/**
 * "Pagar con MercadoPago": crea la suscripción en MP (preapproval con el
 * `mp_plan_id` del plan, `external_reference` = `<tienda>:<plan>`) y devuelve
 * el `init_point` para redirigir. El plan NO se activa acá: lo activa el
 * webhook cuando MP confirma. `billing_start_checkout` sólo la puede ejecutar
 * service_role: se llama con el cliente de service.ts DESPUÉS de `ownerOnly`.
 */
export async function startMercadoPagoCheckout(input: { plan: string }): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const denied = ownerOnly(ctx);
    if (denied) return fail(denied);
    if (!billingEnabled()) return fail("El pago con MercadoPago no está disponible. Pedí el plan por WhatsApp.");
    const parsed = z.object({ plan: z.enum(PLAN_CODES) }).safeParse(input);
    if (!parsed.success) return fail("Plan inválido.");
    const payerEmail = ctx.user.email?.trim();
    if (!isEmail(payerEmail)) return fail("Tu cuenta no tiene un email válido para MercadoPago.");
    const db = billingServiceClient();
    if (!db) return fail("El pago con MercadoPago no está disponible. Pedí el plan por WhatsApp.");

    try {
      const res = await startCheckout(
        { storeId: ctx.store.id, storeName: ctx.store.name, planCode: parsed.data.plan, origin: platformOrigin(), payerEmail },
        {
          loadPlan: async (code) => {
            const { data, error } = await ctx.supabase.from("plans").select("code, name, mp_plan_id").eq("code", code).maybeSingle();
            if (error) return null;
            return data;
          },
          loadSubscription: async () => {
            const { data, error } = await ctx.supabase
              .from("subscriptions")
              .select("plan_code, status, provider, provider_ref, provider_status, cancel_at_period_end")
              .eq("store_id", ctx.store.id)
              .maybeSingle();
            if (error) throw new Error(`subscriptions: ${error.message}`);
            return data;
          },
          recordCheckout: async ({ planCode, preapprovalId }) => {
            // Service role: la tienda sale de la sesión (ctx) y el plan, de la tabla plans.
            const { error } = await db.rpc("billing_start_checkout", {
              p_store_id: ctx.store.id,
              p_plan_code: planCode,
              p_provider_ref: preapprovalId,
            });
            if (!error) return null;
            console.error("[billing] billing_start_checkout:", error.message);
            return error.code === "P0001" ? error.message : "No pudimos registrar el pago. Probá de nuevo en unos minutos.";
          },
        },
      );
      if (!res.ok) return fail(res.error);
      await logAudit(ctx, {
        action: "plan.checkout_started",
        entity: "subscription",
        entityId: ctx.store.id,
        summary: `Empezó el pago de ${PLAN_NAMES[parsed.data.plan as PlanCode]} con MercadoPago`,
        diff: {
          plan: [ctx.plan.code, parsed.data.plan],
          preapproval: [res.replaced?.id ?? null, res.preapprovalId],
          ...(res.replaced ? { previous_cancelled: [false, res.replaced.cancelled] } : {}),
        },
      });
      return ok({ url: res.url });
    } catch (err) {
      const message = mpErrorMessage(err);
      if (message) return fail(message);
      throw err;
    }
  });
}

/**
 * "Cancelar renovación": `PUT /preapproval/<id>` con `status: cancelled`. La
 * tienda mantiene el plan hasta `current_period_end`; después pasa a Free
 * (run_daily_maintenance). Se sincroniza en el acto si hay service role; si
 * no, lo aplica el webhook de MP.
 */
export async function cancelMercadoPagoRenewal(): Promise<ActionResult<{ summary: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const denied = ownerOnly(ctx);
    if (denied) return fail(denied);
    if (!billingEnabled()) return fail("El cobro con MercadoPago no está disponible en este momento.");
    const { data: sub, error } = await ctx.supabase
      .from("subscriptions")
      .select("provider, provider_ref, provider_status, cancel_at_period_end")
      .eq("store_id", ctx.store.id)
      .maybeSingle();
    if (error) return fail("No pudimos leer tu suscripción. Probá de nuevo en unos minutos.");
    if (!sub || sub.provider !== "mercadopago" || !sub.provider_ref) return fail("Tu plan no se cobra con MercadoPago.");
    if (sub.cancel_at_period_end || sub.provider_status === "cancelled") return fail("La renovación ya está cancelada.");

    try {
      await cancelPreapproval(sub.provider_ref);
    } catch (err) {
      const message = mpErrorMessage(err);
      if (message) return fail(message);
      throw err;
    }

    let summary = "Cancelamos la renovación. MercadoPago nos confirma el cambio en unos minutos.";
    const db = billingServiceClient();
    if (db) {
      try {
        const result = await syncPreapproval(sub.provider_ref, { expectedStoreId: ctx.store.id }, { repo: supabaseBillingRepo(db) });
        console.info(`[billing] cancelación ${ctx.store.slug}: ${describeResult(result)}`);
        if (result.outcome === "applied") summary = "Cancelamos la renovación: el plan sigue activo hasta el final del período pago.";
      } catch (err) {
        console.error("[billing] sync tras cancelar:", err instanceof Error ? err.message : err);
      }
    }
    await logAudit(ctx, {
      action: "plan.renewal_cancelled",
      entity: "subscription",
      entityId: ctx.store.id,
      summary: `Canceló la renovación de ${ctx.plan.name} en MercadoPago`,
    });
    revalidatePath("/admin/plan");
    return ok({ summary });
  });
}
