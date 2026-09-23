import { createHash } from "node:crypto";

import { billingPeriodArg, isBillingPeriod, planWithPeriod, validYearly, validYearlyOffer, type BillingPeriod } from "@/lib/plans/yearly";

import { cancelPreapproval, createPreapproval, getPreapprovalPlan, MercadoPagoError, type CreatePreapprovalBody } from "./mercadopago";
import { isChargingStatus, PERIOD_FREQUENCY } from "./state";
import type { BillingSubscriptionRow } from "./types";

/*
 * Inicio del pago de un plan (/admin/plan → "Pagar con MercadoPago").
 *
 * Crea el `preapproval` en MP y lo registra como PENDIENTE
 * (`billing_start_checkout`, service role: provider = mercadopago,
 * provider_ref, provider_status = pending). El plan NO se activa acá: lo
 * activa el webhook cuando MP avisa que la suscripción quedó `authorized`.
 *
 * `external_reference` = `<store_id>:<plan_code>` (mensual) o
 * `<store_id>:<plan_code>:yearly` (anual, 0019): el webhook saca el plan y la
 * periodicidad de ahí (o del `preapproval_plan_id`), nunca de lo que haya
 * quedado en la base.
 *
 * Anual: con `plans.mp_plan_id_yearly` se usa ese plan de MP (frecuencia de
 * 12 meses); sin él, la suscripción se crea sin plan asociado con
 * `auto_recurring` = `price_yearly` cada 12 meses (el webhook exige ese monto
 * y esa frecuencia con `recurringMatchesPlan`).
 *
 * Antes de crear uno nuevo se cancela en MP el preapproval anterior de la
 * tienda si todavía puede cobrar (checkout a medias o renovación cancelada
 * que MP sigue viendo autorizada): así no quedan dos débitos automáticos.
 */

export interface CheckoutInput {
  storeId: string;
  storeName: string;
  planCode: string;
  /** Origen de la plataforma (`https://www.ecommy.app`), para el `back_url`. */
  origin: string;
  payerEmail: string;
  /** Periodicidad elegida (0019). Por defecto, mensual. */
  period?: BillingPeriod;
}

export interface CheckoutPlan {
  code: string;
  name: string;
  mp_plan_id: string | null;
  /** 0019 (ausentes sin la migración = sin anual). */
  mp_plan_id_yearly?: string | null;
  price_yearly?: number | string | null;
  /** Para validar el anual contra el mensual (`validYearlyOffer`). Ausente = sólo se exige `price_yearly > 0`. */
  price_monthly?: number | string | null;
  currency?: string | null;
}

/** Suscripción que mira el checkout. `billing_period` llega con 0019 (ausente = mensual). */
export type CheckoutSubscription = Pick<
  BillingSubscriptionRow,
  "provider" | "provider_ref" | "provider_status" | "cancel_at_period_end" | "plan_code" | "status"
> & { billing_period?: string | null };

export interface CheckoutDeps {
  loadPlan(code: string): Promise<CheckoutPlan | null>;
  loadSubscription(): Promise<CheckoutSubscription | null>;
  /** RPC `billing_start_checkout` (service role). Devuelve el mensaje de error o null. */
  recordCheckout(args: { planCode: string; preapprovalId: string; period: BillingPeriod }): Promise<string | null>;
  createPreapproval?: typeof createPreapproval;
  getPreapprovalPlan?: typeof getPreapprovalPlan;
  cancelPreapproval?: typeof cancelPreapproval;
}

export type CheckoutResult =
  | {
      ok: true;
      url: string;
      preapprovalId: string;
      mode: "plan" | "inline";
      /** Preapproval anterior que se canceló (o se intentó cancelar) en MP. */
      replaced: { id: string; cancelled: boolean } | null;
    }
  | { ok: false; error: string };

/** "Ecommy Pro · Taller Luna" (MP lo muestra en el checkout y en el resumen de la tarjeta). */
export function checkoutReason(planName: string, storeName: string): string {
  const clean = (v: string) => v.replace(/\s+/g, " ").trim();
  return `Ecommy ${clean(planName)} · ${clean(storeName)}`.slice(0, 120);
}

export function checkoutBackUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/admin/plan?mp=ok`;
}

/**
 * `<store_id>:<plan_code>` (mensual, igual que antes de 0019) o
 * `<store_id>:<plan_code>:yearly` (ver `parseExternalReference` en state.ts).
 */
export function externalReference(storeId: string, planCode: string, period: BillingPeriod = "monthly"): string {
  return period === "yearly" ? `${storeId}:${planCode}:yearly` : `${storeId}:${planCode}`;
}

type BodyInput = CheckoutInput & { planName: string };

function baseBody(input: BodyInput): Omit<CreatePreapprovalBody, "preapproval_plan_id" | "status" | "auto_recurring"> {
  const period = input.period ?? "monthly";
  return {
    payer_email: input.payerEmail,
    external_reference: externalReference(input.storeId, input.planCode, period),
    back_url: checkoutBackUrl(input.origin),
    reason: checkoutReason(planWithPeriod(input.planName, period), input.storeName),
  };
}

/** Cuerpo del `POST /preapproval` con plan asociado. */
export function buildPreapprovalBody(input: BodyInput & { mpPlanId: string }): CreatePreapprovalBody {
  return { preapproval_plan_id: input.mpPlanId, ...baseBody(input) };
}

/**
 * Cuerpo del `POST /preapproval` SIN plan asociado (`status: pending`: MP
 * devuelve un `init_point` donde el dueño carga la tarjeta).
 */
export function buildInlinePreapprovalBody(
  input: BodyInput,
  recurring: { frequency: number; frequency_type: string; transaction_amount: number; currency_id: string },
): CreatePreapprovalBody {
  return { ...baseBody(input), status: "pending", auto_recurring: recurring };
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

/** ¿Hay que cancelar en MP el preapproval guardado antes de crear otro? */
export function previousToCancel(
  sub: Pick<BillingSubscriptionRow, "provider" | "provider_ref" | "provider_status"> | null,
): string | null {
  if (sub?.provider !== "mercadopago" || !sub.provider_ref) return null;
  // "expired": pasó a Free por falta de cobro, pero en MP puede seguir autorizado y reintentando.
  return sub.provider_status === "pending" || sub.provider_status === "expired" || isChargingStatus(sub.provider_status) ? sub.provider_ref : null;
}

/**
 * Argumentos de la RPC `billing_start_checkout`. Sólo el anual manda
 * `p_billing_period`: el mensual es el default de 0019, así la llamada
 * mensual funciona con o sin la migración.
 */
export function billingStartCheckoutArgs(args: { storeId: string; planCode: string; preapprovalId: string; period: BillingPeriod }) {
  return {
    p_store_id: args.storeId,
    p_plan_code: args.planCode,
    p_provider_ref: args.preapprovalId,
    ...billingPeriodArg(args.period),
  };
}

/** `X-Idempotency-Key`: mismo intento (doble clic en el mismo minuto) = misma clave. */
function idempotencyKey(parts: string[]): string {
  return `ecommy-${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 48)}`;
}

export async function startCheckout(input: CheckoutInput, deps: CheckoutDeps): Promise<CheckoutResult> {
  const create = deps.createPreapproval ?? createPreapproval;
  const readPlan = deps.getPreapprovalPlan ?? getPreapprovalPlan;
  const cancel = deps.cancelPreapproval ?? cancelPreapproval;

  const period: BillingPeriod = input.period ?? "monthly";
  const plan = await deps.loadPlan(input.planCode);
  // Plan de MP que cobra: el mensual o el anual. El anual puede no tener (se crea sin plan asociado).
  const mpPlanId = (period === "yearly" ? plan?.mp_plan_id_yearly : plan?.mp_plan_id) || null;
  const yearlyNumber = Number(plan?.price_yearly ?? Number.NaN);
  const monthlyRaw = plan?.price_monthly;
  // Con el precio mensual a mano, el anual tiene que ser una oferta creíble (ahorra algo, no más del 60 %).
  const yearlyPrice =
    period !== "yearly"
      ? null
      : monthlyRaw === undefined
        ? validYearly(yearlyNumber)
        : validYearlyOffer(monthlyRaw === null ? null : Number(monthlyRaw), yearlyNumber);
  if (!plan || (period === "monthly" && !mpPlanId)) {
    return { ok: false, error: "Ese plan todavía no se puede pagar con MercadoPago. Pedilo por WhatsApp." };
  }
  if (period === "yearly" && yearlyPrice === null) return { ok: false, error: "Ese plan no tiene pago anual. Pedilo por WhatsApp." };

  const sub = await deps.loadSubscription();
  // Una suscripción autorizada o pausada puede volver a cobrar: primero se cancela la renovación.
  if (sub?.provider === "mercadopago" && isChargingStatus(sub.provider_status) && !sub.cancel_at_period_end) {
    if (sub.plan_code === plan.code && sub.status === "active") {
      const subPeriod: BillingPeriod = isBillingPeriod(sub.billing_period) ? sub.billing_period : "monthly";
      if (subPeriod === period) return { ok: false, error: "Ya estás pagando este plan con MercadoPago." };
      return {
        ok: false,
        error:
          period === "yearly"
            ? "Cancelá la renovación mensual para pasar al anual."
            : "Cancelá la renovación anual para pasar al mensual.",
      };
    }
    return { ok: false, error: "Ya tenés una suscripción activa en MercadoPago: cancelá la renovación antes de cambiar de plan." };
  }

  // Preapproval anterior que todavía puede cobrar: se cancela antes de crear el nuevo.
  const previous = previousToCancel(sub);
  let replaced: { id: string; cancelled: boolean } | null = null;
  if (previous) {
    try {
      await cancel(previous);
      replaced = { id: previous, cancelled: true };
    } catch (err) {
      // Sigue igual: si ese preapproval llega a autorizarse, el webhook lo cancela como duplicado.
      console.warn("[billing] no se pudo cancelar el preapproval anterior:", err instanceof Error ? err.message : err);
      replaced = { id: previous, cancelled: false };
    }
  }

  const bodyInput: BodyInput = { ...input, planCode: plan.code, planName: plan.name, period };
  // Mismo intento (doble clic) = misma clave; otro minuto u otro preapproval reemplazado, otra clave.
  const keyParts = [input.storeId, plan.code, String(Math.floor(Date.now() / 60_000)), previous ?? ""];
  const key = idempotencyKey(period === "yearly" ? [...keyParts, "yearly"] : keyParts);
  let mode: "plan" | "inline" = "plan";
  let preapproval;
  if (!mpPlanId) {
    // Anual sin plan de MP: precio anual cada 12 meses.
    if (yearlyPrice === null) return { ok: false, error: "Ese plan no tiene pago anual. Pedilo por WhatsApp." };
    mode = "inline";
    preapproval = await create(
      buildInlinePreapprovalBody(bodyInput, {
        ...PERIOD_FREQUENCY.yearly,
        transaction_amount: yearlyPrice,
        currency_id: (plan.currency || "ARS").toUpperCase(),
      }),
      `${key}-inline`,
    );
  } else {
    const mpId = mpPlanId;
    try {
      preapproval = await create(buildPreapprovalBody({ ...bodyInput, mpPlanId: mpId }), key);
    } catch (err) {
      if (!needsCardToken(err)) throw err;
      const mpPlan = await readPlan(mpId);
      const ar = mpPlan.auto_recurring;
      if (!ar?.transaction_amount || !ar.frequency || !ar.frequency_type) throw err;
      mode = "inline";
      preapproval = await create(
        buildInlinePreapprovalBody(bodyInput, {
          frequency: ar.frequency,
          frequency_type: ar.frequency_type,
          transaction_amount: ar.transaction_amount,
          currency_id: ar.currency_id ?? "ARS",
        }),
        `${key}-inline`,
      );
    }
  }
  if (!preapproval?.id || !isMercadoPagoUrl(preapproval.init_point)) {
    return { ok: false, error: "MercadoPago no devolvió el link de pago. Probá de nuevo en unos minutos." };
  }
  const recordError = await deps.recordCheckout({ planCode: plan.code, preapprovalId: preapproval.id, period });
  if (recordError) return { ok: false, error: recordError };
  return { ok: true, url: preapproval.init_point, preapprovalId: preapproval.id, mode, replaced };
}
