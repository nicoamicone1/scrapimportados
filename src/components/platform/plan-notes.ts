import { PLAN_CODES, PLAN_DEFAULTS, PLAN_NAMES, type FeatureKey, type PlanInfo } from "@/lib/plans";

/*
 * "Desde qué plan" para los textos públicos (landing, FAQ). Se calcula con
 * los planes de la base (editables en /platform) para que el copy no quede
 * desactualizado; sin planes cargados usa los defaults del código.
 */

export type PlanLike = Pick<PlanInfo, "features" | "name">;

function orDefaults(plans: readonly PlanLike[]): readonly PlanLike[] {
  return plans.length ? plans : PLAN_CODES.map((code) => ({ name: PLAN_NAMES[code], features: PLAN_DEFAULTS[code].features }));
}

/** Nombre del primer plan (en orden) que incluye la función, o `null` si ninguno. */
export function minPlanName(plans: readonly PlanLike[], key: FeatureKey): string | null {
  return orDefaults(plans).find((p) => p.features[key])?.name ?? null;
}

/** "todos los planes" · "desde Starter" · "a pedido" (si ningún plan público la incluye). */
export function availability(plans: readonly PlanLike[], key: FeatureKey): string {
  const list = orDefaults(plans);
  const idx = list.findIndex((p) => p.features[key]);
  if (idx === -1) return "a pedido";
  if (idx === 0 && list.every((p) => p.features[key])) return "todos los planes";
  return `desde ${list[idx].name}`;
}
