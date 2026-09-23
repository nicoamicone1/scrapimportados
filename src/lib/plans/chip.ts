import { trialDaysLeft, type PlanInfo } from "./index";

export interface PlanChip {
  label: string;
  tone: "plan" | "trial" | "warning";
}

/**
 * Texto y tono del chip de plan (sidebar, dashboard, /app):
 * "Pro", "Prueba Pro · 9 días", "Pago pendiente". Puro.
 */
export function getPlanChip(ctx: { plan: Pick<PlanInfo, "name" | "status" | "trialEndsAt"> }, now: Date = new Date()): PlanChip {
  const { plan } = ctx;
  if (plan.status === "trialing") {
    const days = trialDaysLeft(plan, now);
    return { label: `Prueba ${plan.name} · ${days} ${days === 1 ? "día" : "días"}`, tone: "trial" };
  }
  if (plan.status === "past_due") return { label: `${plan.name} · pago pendiente`, tone: "warning" };
  return { label: plan.name, tone: "plan" };
}
