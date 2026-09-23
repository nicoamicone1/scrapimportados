import { formatMoney } from "@/lib/money";

/*
 * Pago anual de los planes (docs/MARKETING.md §5.2, docs/BILLING.md): se
 * paga el año por adelantado y el precio queda fijo 12 meses. Puro e
 * isomórfico (landing, /planes, /admin/plan, mails, tests).
 *
 *   yearlySavingsPercent(14999, 149990)  → 17   (1 − anual / (mensual × 12))
 *   monthlyEquivalent(149990)            → 12499 (anual / 12, en pesos enteros)
 *   yearlyOffer(14999, 149990)           → "12 meses por el precio de 10"
 */

export const BILLING_PERIODS = ["monthly", "yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

/** "mensual" · "anual". */
export function billingPeriodLabel(period: BillingPeriod): string {
  return period === "yearly" ? "anual" : "mensual";
}

/** Precio anual válido (> 0) o null. */
export function validYearly(priceYearly: number | null | undefined): number | null {
  return typeof priceYearly === "number" && Number.isFinite(priceYearly) && priceYearly > 0 ? priceYearly : null;
}

/**
 * Ahorro del anual contra 12 meses, en % entero (redondeado). `null` si no hay
 * anual, no hay precio mensual o el anual no ahorra nada.
 */
export function yearlySavingsPercent(priceMonthly: number | null | undefined, priceYearly: number | null | undefined): number | null {
  const yearly = validYearly(priceYearly);
  if (yearly === null || typeof priceMonthly !== "number" || !Number.isFinite(priceMonthly) || priceMonthly <= 0) return null;
  const pct = Math.round((1 - yearly / (priceMonthly * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** Lo que sale por mes pagando el año (anual / 12, redondeado a pesos enteros). */
export function monthlyEquivalent(priceYearly: number | null | undefined): number | null {
  const yearly = validYearly(priceYearly);
  return yearly === null ? null : Math.round(yearly / 12);
}

/**
 * Cuántos meses de precio mensual cuesta el año, si da justo (±1 peso por
 * mes de redondeo): 149990 con 14999 → 10. `null` si no es un número entero
 * de meses menor que 12.
 */
export function yearlyMonthsPaid(priceMonthly: number | null | undefined, priceYearly: number | null | undefined): number | null {
  const yearly = validYearly(priceYearly);
  if (yearly === null || typeof priceMonthly !== "number" || !(priceMonthly > 0)) return null;
  const months = Math.round(yearly / priceMonthly);
  if (months < 1 || months >= 12) return null;
  return Math.abs(yearly - months * priceMonthly) <= months ? months : null;
}

/** "12 meses por el precio de 10" · "ahorrás 17 %" · null (el anual no ahorra o no hay). */
export function yearlyOffer(priceMonthly: number | null | undefined, priceYearly: number | null | undefined): string | null {
  const months = yearlyMonthsPaid(priceMonthly, priceYearly);
  if (months !== null) return `12 meses por el precio de ${months}`;
  const pct = yearlySavingsPercent(priceMonthly, priceYearly);
  return pct === null ? null : `ahorrás ${pct} %`;
}

/**
 * Línea bajo el precio mensual (PlanCards):
 * "Pagando el año: 12 meses por el precio de 10 · $ 12.499 por mes".
 * `null` si el plan no tiene anual.
 */
export function yearlyLine(plan: { priceMonthly: number | null; priceYearly: number | null; currency: string }): string | null {
  const equivalent = monthlyEquivalent(plan.priceYearly);
  if (equivalent === null) return null;
  const offer = yearlyOffer(plan.priceMonthly, plan.priceYearly);
  const perMonth = `${formatMoney(equivalent, { currency: plan.currency || "ARS" })} por mes`;
  return `Pagando el año: ${offer ? `${offer} · ` : ""}${perMonth}`;
}

/** "Pro" · "Pro anual". */
export function planWithPeriod(planName: string, period: BillingPeriod): string {
  return period === "yearly" ? `${planName} anual` : planName;
}
