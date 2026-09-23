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

/**
 * Parámetro de periodicidad para las RPC de 0019 (`billing_start_checkout`,
 * `billing_apply_subscription`, `platform_set_plan`): sólo el anual lo manda.
 * El mensual es el default de la función, así la llamada mensual funciona con
 * o sin la migración.
 */
export function billingPeriodArg(period: BillingPeriod | null | undefined): { p_billing_period?: "yearly" } {
  return period === "yearly" ? { p_billing_period: "yearly" } : {};
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
 * Ahorro máximo creíble del anual (60 %: el año por menos de 4,8 meses). Más
 * que eso se trata como un error de carga (por ejemplo, el precio mensual en
 * el campo del anual) y el anual no se ofrece.
 */
export const MAX_YEARLY_SAVINGS = 0.6;

/**
 * Qué tiene de malo el precio anual respecto del mensual, o `null` si sirve:
 * tiene que haber precio mensual (> 0) y el anual tiene que ahorrar algo
 * (menos que 12 meses) sin ahorrar más del 60 % (lo que además garantiza que
 * cueste al menos un mes). Lo usan /platform/planes al guardar y todo lo que
 * muestra u ofrece el anual (`validYearlyOffer`).
 */
export function yearlyPriceProblem(priceMonthly: number | null | undefined, priceYearly: number | null | undefined): string | null {
  const yearly = validYearly(priceYearly);
  if (yearly === null) return "El precio anual tiene que ser mayor que cero.";
  if (typeof priceMonthly !== "number" || !Number.isFinite(priceMonthly) || priceMonthly <= 0) {
    return "El plan no tiene precio por mes: el pago anual necesita uno para comparar.";
  }
  if (yearly < priceMonthly) return "El precio anual es menor que un mes: revisalo.";
  if (yearly >= priceMonthly * 12) return "El precio anual tiene que ser menor que 12 meses: así no ahorra nada.";
  if (1 - yearly / (priceMonthly * 12) > MAX_YEARLY_SAVINGS) {
    return `El precio anual ahorra más del ${Math.round(MAX_YEARLY_SAVINGS * 100)}\u00a0% contra 12 meses: revisalo.`;
  }
  return null;
}

/** El precio anual si se puede ofrecer (ver `yearlyPriceProblem`), o `null`. */
export function validYearlyOffer(priceMonthly: number | null | undefined, priceYearly: number | null | undefined): number | null {
  return yearlyPriceProblem(priceMonthly, priceYearly) === null ? validYearly(priceYearly) : null;
}

/**
 * Ahorro del anual contra 12 meses, en % entero (redondeado). `null` si no hay
 * anual que ofrecer (sin precio mensual, no ahorra o ahorra demasiado para
 * ser cierto: `validYearlyOffer`).
 */
export function yearlySavingsPercent(priceMonthly: number | null | undefined, priceYearly: number | null | undefined): number | null {
  const yearly = validYearlyOffer(priceMonthly, priceYearly);
  if (yearly === null || typeof priceMonthly !== "number") return null;
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
  const yearly = validYearlyOffer(priceMonthly, priceYearly);
  if (yearly === null || typeof priceMonthly !== "number") return null;
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
 * `null` si el plan no tiene anual o el anual no se puede ofrecer
 * (`validYearlyOffer`: no ahorra, o ahorra más del 60 %).
 */
export function yearlyLine(plan: { priceMonthly: number | null; priceYearly: number | null; currency: string }): string | null {
  const equivalent = monthlyEquivalent(validYearlyOffer(plan.priceMonthly, plan.priceYearly));
  if (equivalent === null) return null;
  const offer = yearlyOffer(plan.priceMonthly, plan.priceYearly);
  const perMonth = `${formatMoney(equivalent, { currency: plan.currency || "ARS" })} por mes`;
  return `Pagando el año: ${offer ? `${offer} · ` : ""}${perMonth}`;
}

/** "Pro" · "Pro anual". */
export function planWithPeriod(planName: string, period: BillingPeriod): string {
  return period === "yearly" ? `${planName} anual` : planName;
}
