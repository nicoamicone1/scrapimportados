import { billingPeriodLabel, isBillingPeriod, type BillingPeriod } from "@/lib/plans/yearly";

import type { BillingSubscriptionRow, MpAuthorizedPayment, MpAutoRecurring, MpPreapproval, MpPreapprovalPlan } from "./types";

/*
 * Máquina de estados: qué hacer con `subscriptions` según lo que dice
 * MercadoPago (puro, testeable). Ver docs/BILLING.md › "Estados".
 *
 *   preapproval.status   tienda con período pago de MP      tienda sin período pago (prueba, Free, checkout a medias)
 *   ------------------   --------------------------------   ---------------------------------------------------------
 *   authorized + cobro   active, período = próximo cobro    active (se activa el plan)
 *   authorized sin cobro active (renovación ya cobrada)     active 7 días de gracia, provider_status
 *                        past_due: sigue past_due            = 'authorized_unpaid'; el primer cobro
 *                                                           aprobado lo pasa al período real
 *     + cobro rechazado  past_due (mail "no pudimos…")      sin cambios (mail "no pudimos…")
 *   paused / pending     past_due (mail "no pudimos…")      sin cambios (NO se activa nada sin cobro)
 *   cancelled            active hasta fin de período +      sin cambios (no se corta la prueba)
 *                        cancel_at_period_end (si queda
 *                        período) o cancelled (si no)
 *
 * "Sin cambios" = sólo se guarda `provider_status`. Al vencer el período,
 * `run_daily_maintenance()` pasa a Free las renovaciones canceladas, las
 * `authorized_unpaid` al terminar la gracia y las de MP sin cobro confirmado
 * 7 días después de `current_period_end` (`current_plan()` ya las cuenta como
 * Free aunque el cron no haya corrido).
 */

/** provider_status propio: MP autorizó la suscripción pero todavía no confirmó el primer cobro. */
export const AUTHORIZED_UNPAID = "authorized_unpaid";
/** Días de gracia de una suscripción autorizada sin primer cobro. */
export const UNPAID_GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

export type AppliedStatus = "active" | "past_due" | "cancelled";
export type BillingEmailKind = "activated" | "payment_failed";

export interface BillingDecision {
  /** `null` = no cambia plan ni estado (sólo se registra `providerStatus`). */
  status: AppliedStatus | null;
  planCode: string;
  /** Periodicidad del preapproval (0019): se guarda junto con el plan cuando `status` no es null. */
  billingPeriod: BillingPeriod;
  periodStart: string | null;
  periodEnd: string | null;
  providerStatus: string;
  cancelAtPeriodEnd: boolean;
  lastPaymentAt: string | null;
  email: BillingEmailKind | null;
}

export interface DecideInput {
  preapproval: Pick<MpPreapproval, "id" | "status" | "next_payment_date" | "date_created" | "summarized">;
  /** El cobro que disparó la notificación (`subscription_authorized_payment`). */
  payment?: Pick<MpAuthorizedPayment, "status" | "payment" | "date_created" | "debit_date" | "last_modified"> | null;
  current: Pick<
    BillingSubscriptionRow,
    "plan_code" | "status" | "provider_status" | "current_period_start" | "current_period_end" | "cancel_at_period_end" | "last_payment_at"
  >;
  /** Plan que corresponde al preapproval (por `preapproval_plan_id` o el del `external_reference`). */
  planCode: string;
  /** Periodicidad del preapproval (`resolvePlan`). Por defecto, mensual. */
  period?: BillingPeriod;
  now?: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** ISO válido o null. */
function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

/** ¿La tienda tiene hoy un período de MercadoPago (ya autorizado alguna vez, aunque sea en gracia)? */
export function hasPaidPeriod(current: DecideInput["current"]): boolean {
  return (
    (current.status === "active" || current.status === "past_due") &&
    (current.provider_status === "authorized" ||
      current.provider_status === AUTHORIZED_UNPAID ||
      current.provider_status === "paused" ||
      current.provider_status === "cancelled")
  );
}

/** Estados de MP con los que el débito automático puede cobrar (o cobrar pronto). */
export function isChargingStatus(providerStatus: string | null | undefined): boolean {
  return providerStatus === "authorized" || providerStatus === AUTHORIZED_UNPAID || providerStatus === "paused";
}

/** ¿La tienda tiene un débito automático de MP que puede cobrar (o un checkout a medias que puede completarse)? */
export function mercadoPagoDebitActive(
  sub: { provider: string | null; provider_ref: string | null; provider_status: string | null } | null | undefined,
): boolean {
  return Boolean(sub?.provider === "mercadopago" && sub.provider_ref && (sub.provider_status === "pending" || isChargingStatus(sub.provider_status)));
}

export function paymentRejected(payment: DecideInput["payment"]): boolean {
  if (!payment) return false;
  const inner = payment.payment?.status ?? null;
  return inner === "rejected" || inner === "cancelled" || (payment.status === "recycling" && inner !== "approved");
}

export function paymentApproved(payment: DecideInput["payment"]): boolean {
  return payment?.payment?.status === "approved";
}

export function decideSubscription({ preapproval, payment, current, planCode, period = "monthly", now = new Date() }: DecideInput): BillingDecision {
  const providerStatus = String(preapproval.status || "unknown");
  const paid = hasPaidPeriod(current);
  const keep: BillingDecision = {
    status: null,
    planCode: current.plan_code,
    billingPeriod: period,
    periodStart: null,
    periodEnd: null,
    providerStatus,
    cancelAtPeriodEnd: current.cancel_at_period_end,
    lastPaymentAt: null,
    email: null,
  };

  switch (preapproval.status) {
    case "authorized": {
      const unpaidNow = current.provider_status === AUTHORIZED_UNPAID;
      if (paymentRejected(payment)) {
        // En gracia sin primer cobro: no se pasa a past_due (sumaría 7 días más).
        if (!paid || unpaidNow) return { ...keep, providerStatus: unpaidNow ? AUTHORIZED_UNPAID : providerStatus, email: "payment_failed" };
        return {
          ...keep,
          status: "past_due",
          planCode: current.plan_code,
          email: current.status === "past_due" ? null : "payment_failed",
        };
      }
      const approvedAt = paymentApproved(payment) ? iso(payment?.debit_date) ?? iso(payment?.last_modified) ?? iso(payment?.date_created) : null;
      const lastCharged = iso(preapproval.summarized?.last_charged_date);
      const lastKnown = current.last_payment_at ? new Date(current.last_payment_at).getTime() : Number.NaN;
      // Cobro nuevo: aprobado en este aviso o un último cobro posterior al que ya teníamos.
      const newCharge = approvedAt !== null || (lastCharged !== null && !(new Date(lastCharged).getTime() <= lastKnown));
      // Este preapproval ya tuvo un cobro confirmado (una renovación no necesita otro para seguir activa).
      const confirmed = current.provider_status === "authorized" || (current.provider_status === "paused" && current.last_payment_at !== null);
      const charged = newCharge || (preapproval.summarized?.charged_quantity ?? 0) > 0;

      // past_due sólo sale con un cobro nuevo (un aviso de "authorized" sin cobro no lo regulariza).
      if (paid && current.status === "past_due" && !newCharge) return keep;

      // Primera activación sin ningún cobro: 7 días de gracia, sin extenderlos en cada aviso.
      // Una suscripción que ya venció sin cobro (`expired`) no recibe otra gracia: vuelve sólo con un cobro.
      if (!confirmed && !charged && current.provider_status === "expired") return keep;
      if (!confirmed && !charged) {
        const keepGrace = unpaidNow && current.plan_code === planCode && iso(current.current_period_end) !== null;
        // Si vuelve a suscribirse con período pago por delante (renovación cancelada), no se lo acorta.
        const graceEnd = now.getTime() + UNPAID_GRACE_DAYS * DAY_MS;
        const paidUntil = paid && current.status === "active" ? new Date(current.current_period_end ?? Number.NaN).getTime() : Number.NaN;
        return {
          status: "active",
          planCode,
          billingPeriod: period,
          periodStart: keepGrace ? iso(current.current_period_start) : now.toISOString(),
          periodEnd: keepGrace ? iso(current.current_period_end) : new Date(paidUntil > graceEnd ? paidUntil : graceEnd).toISOString(),
          providerStatus: AUTHORIZED_UNPAID,
          cancelAtPeriodEnd: false,
          lastPaymentAt: null,
          email: keepGrace && current.status === "active" ? null : "activated",
        };
      }

      const periodStart = lastCharged ?? approvedAt ?? iso(current.current_period_start) ?? iso(preapproval.date_created) ?? now.toISOString();
      // El fin lo da MP en next_payment_date (12 meses después del cobro en el anual). Si falta:
      // con un cobro nuevo, el período que ese cobro paga (1 o 12 meses desde el cobro; el
      // current_period_end guardado es del período anterior, o de un mensual cancelado que
      // pasa a anual). Sin cobro nuevo, el guardado sólo si termina después del inicio.
      const estimatedEnd = addMonths(periodStart, period === "yearly" ? 12 : 1);
      const storedEnd = newCharge || unpaidNow ? null : iso(current.current_period_end);
      const periodEnd =
        iso(preapproval.next_payment_date) ??
        (storedEnd !== null && new Date(storedEnd).getTime() > new Date(periodStart).getTime() ? storedEnd : estimatedEnd);
      const alreadyActive = paid && current.status === "active" && current.plan_code === planCode && !current.cancel_at_period_end;
      return {
        status: "active",
        planCode,
        billingPeriod: period,
        periodStart,
        periodEnd,
        providerStatus,
        cancelAtPeriodEnd: false,
        lastPaymentAt: approvedAt ?? lastCharged,
        email: alreadyActive ? null : "activated",
      };
    }
    case "paused":
    case "pending": {
      if (!paid) return keep;
      return { ...keep, status: "past_due", email: current.status === "past_due" ? null : "payment_failed" };
    }
    case "cancelled": {
      if (!paid) return keep;
      const end = current.current_period_end ? new Date(current.current_period_end).getTime() : Number.NaN;
      if (current.status === "active" && end > now.getTime()) {
        return { ...keep, status: "active", cancelAtPeriodEnd: true };
      }
      return { ...keep, status: "cancelled", cancelAtPeriodEnd: false };
    }
    default:
      return keep;
  }
}

/**
 * `external_reference` del preapproval: `<store_id>:<plan_code>[:<period>]`
 * (lo arma el checkout con el plan validado en el servidor). MercadoPago lo
 * guarda y el pagador no lo puede cambiar. Sin tercer campo (checkouts
 * anteriores a 0019 y todos los mensuales) = `monthly`.
 */
export function parseExternalReference(value: unknown): { storeId: string; planCode: string | null; period: BillingPeriod } | null {
  if (typeof value !== "string") return null;
  const [storeId, planCode, period, ...rest] = value.split(":");
  if (rest.length || !isUuid(storeId)) return null;
  if (planCode === undefined) return { storeId, planCode: null, period: "monthly" };
  if (!/^[a-z0-9_-]{1,40}$/.test(planCode)) return null;
  if (period === undefined) return { storeId, planCode, period: "monthly" };
  return isBillingPeriod(period) ? { storeId, planCode, period } : null;
}

export interface BillingPlan {
  code: string;
  mp_plan_id: string | null;
  price_monthly: number | string | null;
  currency: string | null;
  /** 0019 (ausentes sin la migración = sin anual). */
  mp_plan_id_yearly?: string | null;
  price_yearly?: number | string | null;
}

/**
 * Plan de Ecommy de un preapproval:
 * - `preapproval_plan_id` de un plan de Ecommy → ese plan (MP cobra el precio del plan de MP);
 * - si no, el plan del `external_reference` (`via: "reference"`: el caller
 *   tiene que verificar el monto con `recurringMatchesPlan`).
 * Nunca sale de un dato que haya elegido el usuario.
 */
export function resolvePlan(
  preapproval: Pick<MpPreapproval, "preapproval_plan_id">,
  plans: BillingPlan[],
  referencePlan: string | null,
  referencePeriod: BillingPeriod = "monthly",
): { plan: BillingPlan; via: "mp_plan" | "reference"; period: BillingPeriod } | null {
  const mpPlan = preapproval.preapproval_plan_id;
  if (mpPlan) {
    const monthly = plans.find((p) => p.mp_plan_id === mpPlan);
    if (monthly) return { plan: monthly, via: "mp_plan", period: "monthly" };
    const yearly = plans.find((p) => p.mp_plan_id_yearly === mpPlan);
    if (yearly) return { plan: yearly, via: "mp_plan", period: "yearly" };
  }
  const byRef = referencePlan ? plans.find((p) => p.code === referencePlan) : undefined;
  return byRef ? { plan: byRef, via: "reference", period: referencePeriod } : null;
}

/** Frecuencia de MP de cada periodicidad: cada 1 mes o cada 12 meses. */
export const PERIOD_FREQUENCY: Record<BillingPeriod, { frequency: number; frequency_type: "months" }> = {
  monthly: { frequency: 1, frequency_type: "months" },
  yearly: { frequency: 12, frequency_type: "months" },
};

/**
 * ¿El cobro recurrente del preapproval es el precio del plan en esa
 * periodicidad (monto, moneda y frecuencia)? Mensual: `price_monthly` cada 1
 * mes. Anual: `price_yearly` cada 12 meses.
 */
export function recurringMatchesPlan(
  ar: MpAutoRecurring | null | undefined,
  plan: Pick<BillingPlan, "price_monthly" | "currency"> & Partial<Pick<BillingPlan, "price_yearly">>,
  period: BillingPeriod = "monthly",
): boolean {
  const expected = period === "yearly" ? plan.price_yearly : plan.price_monthly;
  if (!ar || expected === null || expected === undefined) return false;
  const amount = Number(ar.transaction_amount);
  const price = Number(expected);
  if (!Number.isFinite(amount) || !Number.isFinite(price) || price <= 0 || Math.abs(amount - price) > 0.005) return false;
  if ((ar.currency_id ?? "").toUpperCase() !== (plan.currency || "ARS").toUpperCase()) return false;
  const freq = PERIOD_FREQUENCY[period];
  return Number(ar.frequency) === freq.frequency && ar.frequency_type === freq.frequency_type;
}

/**
 * Control de un `preapproval_plan` de MercadoPago antes de guardarlo en
 * /platform/planes (mensual en `mp_plan_id`, anual en `mp_plan_id_yearly`):
 * tiene que traer el cobro recurrente, con la frecuencia del período (cada 1
 * mes o cada 12 meses) y la moneda del plan; con `amount`, además ese monto.
 * Devuelve el problema para el superadmin, o `null`.
 */
export function mpPlanProblem(
  mp: Pick<MpPreapprovalPlan, "auto_recurring">,
  expected: { period: BillingPeriod; currency: string | null | undefined; amount?: number | null },
): string | null {
  const ar = mp.auto_recurring;
  const label = billingPeriodLabel(expected.period);
  if (!ar) return "MercadoPago no devolvió el cobro recurrente de ese plan (monto y frecuencia): revisalo en MercadoPago.";
  const freq = PERIOD_FREQUENCY[expected.period];
  if (!(Number(ar.frequency) === freq.frequency && ar.frequency_type === freq.frequency_type)) {
    return `Ese plan de MercadoPago cobra cada ${ar.frequency ?? "?"} ${ar.frequency_type ?? "?"}: el ${label} tiene que cobrar cada ${freq.frequency === 1 ? "mes" : "12 meses"}.`;
  }
  const currency = (expected.currency || "ARS").toUpperCase();
  if ((ar.currency_id ?? "").toUpperCase() !== currency) {
    return `Ese plan de MercadoPago cobra en ${ar.currency_id ?? "?"} y el plan está en ${currency}: tienen que coincidir.`;
  }
  if (typeof expected.amount === "number") {
    const amount = Number(ar.transaction_amount);
    if (!Number.isFinite(amount) || Math.abs(amount - expected.amount) > 0.005) {
      return `Ese plan de MercadoPago cobra ${ar.transaction_amount ?? "?"} y el precio ${label} es ${expected.amount}: igualalos antes de guardar.`;
    }
  }
  return null;
}

/**
 * ¿El id de MercadoPago ya lo usa otro campo? Un mismo `preapproval_plan` no
 * puede ser el mensual y el anual (del mismo plan o de otro), ni el de dos
 * planes: el webhook no sabría qué plan ni qué período activar.
 */
export function mpPlanIdConflict(
  id: string,
  target: { code: string; period: BillingPeriod },
  plans: readonly { code: string; mp_plan_id?: string | null; mp_plan_id_yearly?: string | null }[],
): string | null {
  if (!id) return null;
  for (const p of plans) {
    for (const period of ["monthly", "yearly"] as const) {
      if (p.code === target.code && period === target.period) continue;
      const other = period === "yearly" ? p.mp_plan_id_yearly : p.mp_plan_id;
      if (other && other === id) {
        const where = p.code === target.code ? "este plan" : `el plan ${p.code}`;
        return `Ese id ya es el plan ${billingPeriodLabel(period)} de MercadoPago de ${where}: cada plan y período necesita su propio plan en MercadoPago.`;
      }
    }
  }
  return null;
}
