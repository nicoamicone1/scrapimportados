"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, runAction, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { billingStartCheckoutArgs, startCheckout } from "@/lib/billing/checkout";
import { billingEnabled, cancelPreapproval, MercadoPagoError } from "@/lib/billing/mercadopago";
import { billingServiceClient } from "@/lib/billing/service";
import { describeResult, supabaseBillingRepo, syncPreapproval } from "@/lib/billing/sync";
import { notifyPlanRequest } from "@/lib/email/notify";
import { isEmail } from "@/lib/email/send";
import { PLAN_CODES, PLAN_NAMES, type PlanCode } from "@/lib/plans";
import { BILLING_PERIODS, billingPeriodLabel, planWithPeriod, type BillingPeriod } from "@/lib/plans/yearly";
import { platformOrigin, storeDisplayHost } from "@/lib/tenant/urls";

/**
 * "Quiero este plan": registra el pedido en auditoría y devuelve el link de
 * WhatsApp de la plataforma con el mensaje armado. Convive con el cobro
 * automático por MercadoPago (más abajo; docs/BILLING.md).
 *
 * `period`: sólo cuando el plan tiene pago anual y el dueño eligió (el
 * mensaje dice "con pago mensual" o "con pago anual"); sin él, el mensaje es
 * el de siempre.
 *
 * Sólo dueño o administrador: el staff no decide el plan (y cada pedido manda
 * un mail a la casilla de la plataforma).
 */
export async function requestUpgrade(input: { plan: string; period?: BillingPeriod }): Promise<ActionResult<{ url: string | null }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return fail("Sólo el dueño o un administrador de la tienda puede pedir un cambio de plan.");
    }
    const parsed = z.object({ plan: z.enum(PLAN_CODES), period: z.enum(BILLING_PERIODS).optional() }).safeParse(input);
    if (!parsed.success) return fail("Plan inválido.");
    const plan = parsed.data.plan as PlanCode;
    const period = parsed.data.period;
    // Mismo plan: sólo para cambiar la periodicidad (por ejemplo, pasar a pagar el año).
    if (plan === ctx.plan.code && (period ?? "monthly") === ctx.plan.billingPeriod) return fail("Ya estás en ese plan.");
    const requested = planWithPeriod(PLAN_NAMES[plan], period ?? "monthly");
    const current = planWithPeriod(ctx.plan.name, ctx.plan.billingPeriod);

    await logAudit(ctx, {
      action: "plan.upgrade_request",
      entity: "subscription",
      entityId: ctx.store.id,
      summary: `Pidió pasar de ${current} a ${requested}`,
      diff: { plan: [ctx.plan.code, plan], ...(period ? { period: [ctx.plan.billingPeriod, period] } : {}) },
    });
    // Aviso interno a la plataforma (si hay PLATFORM_EMAIL), además del WhatsApp.
    notifyPlanRequest({
      store: ctx.store,
      currentPlan: current,
      currentTrial: ctx.plan.status === "trialing",
      requestedPlanCode: period === "yearly" ? `${plan}-yearly` : plan,
      requestedPlan: requested,
      requestedBy: ctx.user.email,
    });

    const phone = (process.env.PLATFORM_WHATSAPP ?? "").replace(/\D/g, "");
    if (!phone) return ok<{ url: string | null }>({ url: null });
    const text = [
      `Hola! Quiero pasar mi tienda al plan ${PLAN_NAMES[plan]}${period ? ` con pago ${billingPeriodLabel(period)}` : ""}.`,
      "",
      `Tienda: ${ctx.store.name} (${storeDisplayHost(ctx.store)})`,
      `Plan actual: ${current}${ctx.plan.status === "trialing" ? " (prueba)" : ""}`,
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
 * `mp_plan_id` del plan, `external_reference` = `<tienda>:<plan>`; el anual,
 * con `mp_plan_id_yearly` o sin plan asociado y `<tienda>:<plan>:yearly`) y
 * devuelve el `init_point` para redirigir. El plan NO se activa acá: lo activa el
 * webhook cuando MP confirma. `billing_start_checkout` sólo la puede ejecutar
 * service_role: se llama con el cliente de service.ts DESPUÉS de `ownerOnly`.
 */
export async function startMercadoPagoCheckout(input: { plan: string; period?: BillingPeriod }): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const denied = ownerOnly(ctx);
    if (denied) return fail(denied);
    if (!billingEnabled()) return fail("El pago con MercadoPago no está disponible. Pedí el plan por WhatsApp.");
    const parsed = z.object({ plan: z.enum(PLAN_CODES), period: z.enum(BILLING_PERIODS).optional().default("monthly") }).safeParse(input);
    if (!parsed.success) return fail("Plan inválido.");
    const period = parsed.data.period;
    const payerEmail = ctx.user.email?.trim();
    if (!isEmail(payerEmail)) return fail("Tu cuenta no tiene un email válido para MercadoPago.");
    const db = billingServiceClient();
    if (!db) return fail("El pago con MercadoPago no está disponible. Pedí el plan por WhatsApp.");

    try {
      const res = await startCheckout(
        { storeId: ctx.store.id, storeName: ctx.store.name, planCode: parsed.data.plan, origin: platformOrigin(), payerEmail, period },
        {
          loadPlan: async (code) => {
            // Columnas del anual (0019); sin ellas, el plan se lee sin anual.
            const full = await ctx.supabase
              .from("plans")
              .select("code, name, mp_plan_id, mp_plan_id_yearly, price_monthly, price_yearly, currency")
              .eq("code", code)
              .maybeSingle();
            if (!full.error) return full.data;
            const { data, error } = await ctx.supabase.from("plans").select("code, name, mp_plan_id").eq("code", code).maybeSingle();
            if (error) return null;
            return data;
          },
          loadSubscription: async () => {
            // billing_period llega con 0019; sin la columna, se lee sin ella (= mensual).
            const full = await ctx.supabase
              .from("subscriptions")
              .select("plan_code, status, provider, provider_ref, provider_status, cancel_at_period_end, billing_period")
              .eq("store_id", ctx.store.id)
              .maybeSingle();
            if (!full.error) return full.data;
            const { data, error } = await ctx.supabase
              .from("subscriptions")
              .select("plan_code, status, provider, provider_ref, provider_status, cancel_at_period_end")
              .eq("store_id", ctx.store.id)
              .maybeSingle();
            if (error) throw new Error(`subscriptions: ${error.message}`);
            return data;
          },
          recordCheckout: async ({ planCode, preapprovalId, period: chosen }) => {
            // Service role: la tienda sale de la sesión (ctx) y el plan, de la tabla plans.
            // El mensual no manda el período (default de 0019): funciona con o sin la migración.
            const { error } = await db.rpc(
              "billing_start_checkout",
              billingStartCheckoutArgs({ storeId: ctx.store.id, planCode, preapprovalId, period: chosen }),
            );
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
        summary: `Empezó el pago de ${planWithPeriod(PLAN_NAMES[parsed.data.plan as PlanCode], period)} con MercadoPago`,
        diff: {
          plan: [ctx.plan.code, parsed.data.plan],
          ...(period === "yearly" ? { period: [ctx.plan.billingPeriod, period] } : {}),
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
