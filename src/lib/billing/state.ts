import type { BillingSubscriptionRow, MpAuthorizedPayment, MpPreapproval } from "./types";

/*
 * Máquina de estados: qué hacer con `subscriptions` según lo que dice
 * MercadoPago (puro, testeable). Ver docs/BILLING.md › "Estados".
 *
 *   preapproval.status   tienda con período pago de MP      tienda sin período pago (prueba, Free, checkout a medias)
 *   ------------------   --------------------------------   ---------------------------------------------------------
 *   authorized           active, período = próximo cobro    active (se activa el plan)
 *     + cobro rechazado  past_due (mail "no pudimos…")      sin cambios (mail "no pudimos…")
 *   paused / pending     past_due (mail "no pudimos…")      sin cambios (NO se activa nada sin cobro)
 *   cancelled            active hasta fin de período +      sin cambios (no se corta la prueba)
 *                        cancel_at_period_end (si queda
 *                        período) o cancelled (si no)
 *
 * "Sin cambios" = sólo se guarda `provider_status`. Al vencer el período,
 * `run_daily_maintenance()` pasa a Free las renovaciones canceladas y las de
 * MP sin cobro confirmado 7 días después de `current_period_end`
 * (`current_plan()` ya las cuenta como Free aunque el cron no haya corrido).
 */

export type AppliedStatus = "active" | "past_due" | "cancelled";
export type BillingEmailKind = "activated" | "payment_failed";

export interface BillingDecision {
  /** `null` = no cambia plan ni estado (sólo se registra `providerStatus`). */
  status: AppliedStatus | null;
  planCode: string;
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
  /** Plan que corresponde al preapproval (por `preapproval_plan_id` o el elegido en el checkout). */
  planCode: string;
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

function addMonth(isoDate: string): string {
  const d = new Date(isoDate);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/** ¿La tienda tiene hoy un período pago por MercadoPago (ya autorizado alguna vez)? */
export function hasPaidPeriod(current: DecideInput["current"]): boolean {
  return (
    (current.status === "active" || current.status === "past_due") &&
    (current.provider_status === "authorized" || current.provider_status === "paused" || current.provider_status === "cancelled")
  );
}

export function paymentRejected(payment: DecideInput["payment"]): boolean {
  if (!payment) return false;
  const inner = payment.payment?.status ?? null;
  return inner === "rejected" || inner === "cancelled" || (payment.status === "recycling" && inner !== "approved");
}

export function paymentApproved(payment: DecideInput["payment"]): boolean {
  return payment?.payment?.status === "approved";
}

export function decideSubscription({ preapproval, payment, current, planCode, now = new Date() }: DecideInput): BillingDecision {
  const providerStatus = String(preapproval.status || "unknown");
  const paid = hasPaidPeriod(current);
  const keep: BillingDecision = {
    status: null,
    planCode: current.plan_code,
    periodStart: null,
    periodEnd: null,
    providerStatus,
    cancelAtPeriodEnd: current.cancel_at_period_end,
    lastPaymentAt: null,
    email: null,
  };

  switch (preapproval.status) {
    case "authorized": {
      if (paymentRejected(payment)) {
        if (!paid) return { ...keep, email: "payment_failed" };
        return {
          ...keep,
          status: "past_due",
          planCode: current.plan_code,
          email: current.status === "past_due" ? null : "payment_failed",
        };
      }
      const approvedAt = paymentApproved(payment) ? iso(payment?.debit_date) ?? iso(payment?.last_modified) ?? iso(payment?.date_created) : null;
      const lastCharged = iso(preapproval.summarized?.last_charged_date);
      const periodStart = lastCharged ?? approvedAt ?? iso(current.current_period_start) ?? iso(preapproval.date_created) ?? now.toISOString();
      const periodEnd = iso(preapproval.next_payment_date) ?? iso(current.current_period_end) ?? addMonth(periodStart);
      const alreadyActive = paid && current.status === "active" && current.plan_code === planCode && !current.cancel_at_period_end;
      return {
        status: "active",
        planCode,
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

/** Plan de Ecommy de un preapproval: por `preapproval_plan_id` (manda) o el elegido en el checkout. */
export function resolvePlanCode(
  preapproval: Pick<MpPreapproval, "preapproval_plan_id">,
  plans: { code: string; mp_plan_id: string | null }[],
  fallback: string | null,
): string | null {
  const mpPlan = preapproval.preapproval_plan_id;
  if (mpPlan) {
    const match = plans.find((p) => p.mp_plan_id === mpPlan);
    if (match) return match.code;
  }
  return fallback && plans.some((p) => p.code === fallback) ? fallback : null;
}
