/**
 * Plan de la tienda activa (isomórfico: server, client y tests).
 *
 *   hasFeature(ctx.plan, "pricing.bulk")         → boolean
 *   limitOf(ctx.plan, "products")                → number | null (null = ilimitado)
 *   assertFeature(ctx, "pricing.bulk")           → lanza PlanError (runAction → fail(…, code: "plan"))
 *   assertLimit(ctx, "products", count, adding)  → idem si count + adding supera el límite
 */

import {
  FEATURE_KEYS,
  LIMIT_KEYS,
  limitMessage,
  PLAN_CODES,
  PLAN_DEFAULTS,
  PLAN_NAMES,
  upgradeMessage,
  type FeatureKey,
  type LimitKey,
  type PlanCode,
  type PlanFeatures,
  type PlanLimits,
} from "./features";

export * from "./features";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export interface PlanInfo {
  code: PlanCode;
  name: string;
  status: SubscriptionStatus;
  /** Sólo si está en prueba. */
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  priceMonthly: number | null;
  currency: string;
  features: PlanFeatures;
  limits: PlanLimits;
}

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}

/** Normaliza el jsonb de `current_plan(store_id)` (tolerante: defaults del plan). */
export function parsePlan(value: unknown): PlanInfo {
  const raw = isRecord(value) ? value : {};
  const code: PlanCode = isPlanCode(raw.code) ? raw.code : "free";
  const defaults = PLAN_DEFAULTS[code];
  const f = isRecord(raw.features) ? raw.features : {};
  const l = isRecord(raw.limits) ? raw.limits : {};
  const features = Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, typeof f[k] === "boolean" ? f[k] : defaults.features[k]]),
  ) as PlanFeatures;
  const limits = Object.fromEntries(
    LIMIT_KEYS.map((k) => {
      if (!(k in l)) return [k, defaults.limits[k]];
      const v = l[k];
      return [k, v === null ? null : typeof v === "number" && Number.isFinite(v) ? v : defaults.limits[k]];
    }),
  ) as PlanLimits;
  const status = ["trialing", "active", "past_due", "cancelled"].includes(String(raw.status))
    ? (raw.status as SubscriptionStatus)
    : "active";
  const price = raw.price_monthly === null || raw.price_monthly === undefined ? defaults.price : Number(raw.price_monthly);
  return {
    code,
    name: typeof raw.name === "string" && raw.name ? raw.name : PLAN_NAMES[code],
    status,
    trialEndsAt: typeof raw.trial_ends_at === "string" ? raw.trial_ends_at : null,
    currentPeriodEnd: typeof raw.current_period_end === "string" ? raw.current_period_end : null,
    priceMonthly: price === null || Number.isNaN(price) ? null : price,
    currency: typeof raw.currency === "string" ? raw.currency : "ARS",
    features,
    limits,
  };
}

/** Plan por defecto (sin base): útil para tests y como fallback. */
export function defaultPlan(code: PlanCode): PlanInfo {
  return parsePlan({ code, status: "active" });
}

export function hasFeature(plan: Pick<PlanInfo, "features"> | null | undefined, key: FeatureKey): boolean {
  return Boolean(plan?.features[key]);
}

/** Límite del plan (`null` = ilimitado). */
export function limitOf(plan: Pick<PlanInfo, "limits"> | null | undefined, key: LimitKey): number | null {
  if (!plan) return PLAN_DEFAULTS.free.limits[key];
  return plan.limits[key];
}

/** ¿`current + adding` entra en el límite? */
export function withinLimit(
  plan: Pick<PlanInfo, "limits"> | null | undefined,
  key: LimitKey,
  current: number,
  adding = 1,
): boolean {
  const limit = limitOf(plan, key);
  return limit === null || current + adding <= limit;
}

/** Días que le quedan a la prueba (redondeado para arriba; 0 si venció o no hay). */
export function trialDaysLeft(plan: Pick<PlanInfo, "status" | "trialEndsAt">, now: Date = new Date()): number {
  if (plan.status !== "trialing" || !plan.trialEndsAt) return 0;
  const ms = new Date(plan.trialEndsAt).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

/** Error de plan. `runAction()` lo convierte en `fail(message)` con `code: "plan"`. */
export class PlanError extends Error {
  readonly code = "plan" as const;
  readonly feature?: FeatureKey;
  readonly limit?: LimitKey;
  constructor(message: string, detail: { feature?: FeatureKey; limit?: LimitKey } = {}) {
    super(message);
    this.name = "PlanError";
    this.feature = detail.feature;
    this.limit = detail.limit;
  }
}

export function assertFeature(ctx: { plan: Pick<PlanInfo, "features"> }, key: FeatureKey): void {
  if (!hasFeature(ctx.plan, key)) throw new PlanError(upgradeMessage(key), { feature: key });
}

export function assertLimit(
  ctx: { plan: Pick<PlanInfo, "limits" | "name"> },
  key: LimitKey,
  current: number,
  adding = 1,
): void {
  const limit = limitOf(ctx.plan, key);
  if (limit !== null && current + adding > limit) {
    throw new PlanError(limitMessage(key, limit, ctx.plan.name), { limit: key });
  }
}
