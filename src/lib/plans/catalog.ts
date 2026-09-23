import "server-only";

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";

import { parsePlan, type BillingPeriod, type PlanInfo } from "./index";
import { monthlyEquivalent, validYearlyOffer, yearlySavingsPercent } from "./yearly";

export interface PublicPlan extends PlanInfo {
  description: string | null;
  position: number;
  /** Ahorro del anual contra 12 meses, en % entero (`null` = sin anual o no ahorra). */
  yearlySavingsPercent: number | null;
  /** Precio anual / 12 en pesos enteros (`null` = sin anual). */
  monthlyEquivalent: number | null;
}

/**
 * Plan público a partir de la fila de `plans` (sin 0019 no hay `price_yearly` → sin anual).
 * Un anual que no se puede ofrecer (no ahorra, o ahorra más del 60 %:
 * `validYearlyOffer`) queda en `priceYearly: null`: ni la web ni /admin/plan
 * lo muestran.
 */
export function toPublicPlan(row: Record<string, unknown> & { description: string | null; position: number }): PublicPlan {
  const parsed = parsePlan({ ...row, status: "active" });
  const plan = { ...parsed, priceYearly: validYearlyOffer(parsed.priceMonthly, parsed.priceYearly) };
  return {
    ...plan,
    description: row.description,
    position: row.position,
    yearlySavingsPercent: yearlySavingsPercent(plan.priceMonthly, plan.priceYearly),
    monthlyEquivalent: monthlyEquivalent(plan.priceYearly),
  };
}


/** Tag de caché de la tabla `plans` (la edita el superadmin en /platform/planes). */
export const PLANS_TAG = "plans";

/** Planes públicos ordenados (landing, /planes, /admin/plan). */
export const listPublicPlans = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    const supabase = createPublicClient();
    // price_yearly llega con 0019: si la columna falta, se leen los planes sin anual.
    const withYearly = await supabase
      .from("plans")
      .select("code, name, description, price_monthly, price_yearly, currency, position, features, limits")
      .eq("is_public", true)
      .order("position");
    if (!withYearly.error) return (withYearly.data ?? []).map((p) => toPublicPlan(p));
    const { data, error } = await supabase.from("plans").select("code, name, description, price_monthly, currency, position, features, limits").eq("is_public", true).order("position");
    if (error) throw new Error(`No se pudieron leer los planes: ${error.message}`);
    return (data ?? []).map((p) => toPublicPlan(p));
  },
  // v2: PublicPlan suma el anual (0019); la clave nueva no reusa entradas viejas sin esos campos.
  ["public-plans-v2"],
  { tags: [PLANS_TAG], revalidate: 600 },
);

/**
 * "$ 14.999 / mes", "$ 149.990 / año" (anual), "Gratis" o "A medida". Un plan
 * anual cuyo precio anual ya no está cargado (se sacó después del pago)
 * muestra "Pago anual" sin monto: nunca "/ mes".
 */
export function planPriceLabel(
  plan: Pick<PlanInfo, "priceMonthly" | "currency"> & Partial<Pick<PlanInfo, "priceYearly">>,
  period: BillingPeriod = "monthly",
): { amount: string; suffix: string } {
  if (period === "yearly") {
    if (!plan.priceYearly) return { amount: "Pago anual", suffix: "" };
    const amount = new Intl.NumberFormat("es-AR", { style: "currency", currency: plan.currency || "ARS", maximumFractionDigits: 0 }).format(
      plan.priceYearly,
    );
    return { amount, suffix: "/ año" };
  }
  if (plan.priceMonthly === null) return { amount: "A medida", suffix: "" };
  if (plan.priceMonthly === 0) return { amount: "Gratis", suffix: "para siempre" };
  const amount = new Intl.NumberFormat("es-AR", { style: "currency", currency: plan.currency || "ARS", maximumFractionDigits: 0 }).format(
    plan.priceMonthly,
  );
  return { amount, suffix: "/ mes" };
}
