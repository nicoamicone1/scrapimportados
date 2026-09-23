import "server-only";

import { unstable_cache } from "next/cache";

import { createPublicClient } from "@/lib/supabase/server";

import { parsePlan, type PlanInfo } from "./index";

export interface PublicPlan extends PlanInfo {
  description: string | null;
  position: number;
}

/** Tag de caché de la tabla `plans` (la edita el superadmin en /platform/planes). */
export const PLANS_TAG = "plans";

/** Planes públicos ordenados (landing, /planes, /admin/plan). */
export const listPublicPlans = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("plans")
      .select("code, name, description, price_monthly, currency, position, features, limits")
      .eq("is_public", true)
      .order("position");
    if (error) throw new Error(`No se pudieron leer los planes: ${error.message}`);
    return (data ?? []).map((p) => ({
      ...parsePlan({ ...p, status: "active" }),
      description: p.description,
      position: p.position,
    }));
  },
  ["public-plans"],
  { tags: [PLANS_TAG], revalidate: 600 },
);

/** "$ 14.999 / mes", "Gratis" o "A medida". */
export function planPriceLabel(plan: Pick<PlanInfo, "priceMonthly" | "currency">): { amount: string; suffix: string } {
  if (plan.priceMonthly === null) return { amount: "A medida", suffix: "" };
  if (plan.priceMonthly === 0) return { amount: "Gratis", suffix: "para siempre" };
  const amount = new Intl.NumberFormat("es-AR", { style: "currency", currency: plan.currency || "ARS", maximumFractionDigits: 0 }).format(
    plan.priceMonthly,
  );
  return { amount, suffix: "/ mes" };
}
