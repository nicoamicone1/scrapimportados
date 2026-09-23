import { createPreapproval, getPreapprovalPlan, MercadoPagoError, type CreatePreapprovalBody } from "./mercadopago";
import type { BillingSubscriptionRow } from "./types";

/*
 * Inicio del pago de un plan (/admin/plan → "Pagar con MercadoPago").
 *
 * Crea el `preapproval` en MP y lo registra como PENDIENTE
 * (`billing_start_checkout`: provider = mercadopago, provider_ref, provider_status
 * = pending). El plan NO se activa acá: lo activa el webhook cuando MP avisa
 * que la suscripción quedó `authorized`.
 */

export interface CheckoutInput {
  storeId: string;
  storeName: string;
  planCode: string;
  /** Origen de la plataforma (`https://www.ecommy.app`), para el `back_url`. */
  origin: string;
  payerEmail: string;
}

export interface CheckoutPlan {
  code: string;
  name: string;
  mp_plan_id: string | null;
}

export interface CheckoutDeps {
  loadPlan(code: string): Promise<CheckoutPlan | null>;
  loadSubscription(): Promise<Pick<BillingSubscriptionRow, "provider" | "provider_status" | "cancel_at_period_end" | "plan_code" | "status"> | null>;
  /** RPC `billing_start_checkout`. Devuelve el mensaje de error o null. */
  recordCheckout(args: { planCode: string; preapprovalId: string }): Promise<string | null>;
  createPreapproval?: typeof createPreapproval;
  getPreapprovalPlan?: typeof getPreapprovalPlan;
}

export type CheckoutResult = { ok: true; url: string; preapprovalId: string; mode: "plan" | "inline" } | { ok: false; error: string };

/** "Ecommy Pro · Taller Luna" (MP lo muestra en el checkout y en el resumen de la tarjeta). */
export function checkoutReason(planName: string, storeName: string): string {
  const clean = (v: string) => v.replace(/\s+/g, " ").trim();
  return `Ecommy ${clean(planName)} · ${clean(storeName)}`.slice(0, 120);
}

export function checkoutBackUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/admin/plan?mp=ok`;
}

/** Cuerpo del `POST /preapproval` con plan asociado. */
export function buildPreapprovalBody(input: CheckoutInput & { planName: string; mpPlanId: string }): CreatePreapprovalBody {
  return {
    preapproval_plan_id: input.mpPlanId,
    payer_email: input.payerEmail,
    external_reference: input.storeId,
    back_url: checkoutBackUrl(input.origin),
    reason: checkoutReason(input.planName, input.storeName),
  };
}

/**
 * MercadoPago puede pedir `card_token_id` para suscripciones CON plan
 * asociado creadas por API. En ese caso se crea la suscripción sin plan, con
 * el mismo `auto_recurring` del `preapproval_plan` y `status: pending`, que
 * devuelve un `init_point` donde el dueño carga la tarjeta. El plan de
 * Ecommy sale entonces de `subscriptions.provider_plan_code`.
 */
/** Sólo se redirige a un checkout de MercadoPago (https, dominio de MP). */
export function isMercadoPagoUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)mercadopago\.com(\.[a-z]{2})?$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function needsCardToken(err: unknown): boolean {
  return err instanceof MercadoPagoError && err.status === 400 && /card_token/i.test(err.mpMessage);
}

export async function startCheckout(input: CheckoutInput, deps: CheckoutDeps): Promise<CheckoutResult> {
  const create = deps.createPreapproval ?? createPreapproval;
  const readPlan = deps.getPreapprovalPlan ?? getPreapprovalPlan;

  const plan = await deps.loadPlan(input.planCode);
  if (!plan?.mp_plan_id) return { ok: false, error: "Ese plan todavía no se puede pagar con MercadoPago. Pedilo por WhatsApp." };

  const sub = await deps.loadSubscription();
  // Una suscripción autorizada o pausada puede volver a cobrar: primero se cancela la renovación.
  if (sub?.provider === "mercadopago" && (sub.provider_status === "authorized" || sub.provider_status === "paused") && !sub.cancel_at_period_end) {
    if (sub.plan_code === plan.code && sub.status === "active") return { ok: false, error: "Ya estás pagando este plan con MercadoPago." };
    return { ok: false, error: "Ya tenés una suscripción activa en MercadoPago: cancelá la renovación antes de cambiar de plan." };
  }

  const body = buildPreapprovalBody({ ...input, planName: plan.name, mpPlanId: plan.mp_plan_id });
  // Mismo intento (doble clic) = misma clave; otro minuto, otro preapproval.
  const key = `ecommy-${input.storeId}-${plan.code}-${Math.floor(Date.now() / 60_000)}`;
  let mode: "plan" | "inline" = "plan";
  let preapproval;
  try {
    preapproval = await create(body, key);
  } catch (err) {
    if (!needsCardToken(err)) throw err;
    const mpPlan = await readPlan(plan.mp_plan_id);
    const ar = mpPlan.auto_recurring;
    if (!ar?.transaction_amount || !ar.frequency || !ar.frequency_type) throw err;
    mode = "inline";
    const { preapproval_plan_id: _omit, ...rest } = body;
    void _omit;
    preapproval = await create(
      {
        ...rest,
        status: "pending",
        auto_recurring: {
          frequency: ar.frequency,
          frequency_type: ar.frequency_type,
          transaction_amount: ar.transaction_amount,
          currency_id: ar.currency_id ?? "ARS",
        },
      },
      `${key}-inline`,
    );
  }
  if (!preapproval?.id || !isMercadoPagoUrl(preapproval.init_point)) {
    return { ok: false, error: "MercadoPago no devolvió el link de pago. Probá de nuevo en unos minutos." };
  }
  const recordError = await deps.recordCheckout({ planCode: plan.code, preapprovalId: preapproval.id });
  if (recordError) return { ok: false, error: recordError };
  return { ok: true, url: preapproval.init_point, preapprovalId: preapproval.id, mode };
}
