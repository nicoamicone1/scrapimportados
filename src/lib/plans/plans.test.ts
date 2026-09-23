import { describe, expect, it } from "vitest";

import { getPlanChip } from "./chip";
import {
  assertFeature,
  assertLimit,
  defaultPlan,
  FEATURE_KEYS,
  featureMinPlan,
  hasFeature,
  limitOf,
  parsePlan,
  PLAN_CODES,
  PLAN_DEFAULTS,
  PlanError,
  trialDaysLeft,
  upgradeMessage,
  withinLimit,
} from "./index";

describe("hasFeature / limitOf", () => {
  it("Free: sin importador ni precios masivos, 50 productos", () => {
    const free = defaultPlan("free");
    expect(hasFeature(free, "catalog.import_web")).toBe(false);
    expect(hasFeature(free, "pricing.bulk")).toBe(false);
    expect(hasFeature(free, "marketing.coupons")).toBe(true);
    expect(limitOf(free, "products")).toBe(50);
    expect(limitOf(free, "pages")).toBe(1);
  });

  it("Pro: ilimitado (null) en productos", () => {
    const pro = defaultPlan("pro");
    expect(hasFeature(pro, "pricing.bulk")).toBe(true);
    expect(limitOf(pro, "products")).toBeNull();
    expect(withinLimit(pro, "products", 1_000_000)).toBe(true);
  });

  it("sin plan → no hay features y rigen los límites de Free", () => {
    expect(hasFeature(null, "catalog.variants")).toBe(false);
    expect(limitOf(null, "products")).toBe(50);
  });

  it("los planes son monótonos: lo que tiene uno lo tiene el siguiente", () => {
    for (let i = 1; i < PLAN_CODES.length; i++) {
      const prev = PLAN_DEFAULTS[PLAN_CODES[i - 1]];
      const next = PLAN_DEFAULTS[PLAN_CODES[i]];
      for (const k of FEATURE_KEYS) if (prev.features[k]) expect(next.features[k]).toBe(true);
    }
  });
});

describe("parsePlan", () => {
  it("toma features/limits del jsonb y completa con defaults", () => {
    const p = parsePlan({
      code: "starter",
      name: "Starter",
      status: "trialing",
      trial_ends_at: "2026-10-01T00:00:00Z",
      price_monthly: "14999.00",
      features: { "pricing.bulk": true },
      limits: { products: 900, pages: null },
    });
    expect(p.code).toBe("starter");
    expect(p.status).toBe("trialing");
    expect(p.priceMonthly).toBe(14999);
    expect(hasFeature(p, "pricing.bulk")).toBe(true); // override de la base
    expect(hasFeature(p, "catalog.import_csv")).toBe(true); // default de starter
    expect(limitOf(p, "products")).toBe(900);
    expect(limitOf(p, "pages")).toBeNull();
    expect(limitOf(p, "coupons")).toBe(20);
  });

  it("basura → Free activo", () => {
    const p = parsePlan("nada");
    expect(p.code).toBe("free");
    expect(p.status).toBe("active");
  });
});

describe("assertFeature / assertLimit", () => {
  it("lanza PlanError con el plan mínimo", () => {
    const ctx = { plan: defaultPlan("free") };
    expect(() => assertFeature(ctx, "pricing.bulk")).toThrow(PlanError);
    expect(() => assertFeature(ctx, "pricing.bulk")).toThrow("disponible desde el plan Pro");
    expect(() => assertFeature(ctx, "catalog.import_csv")).toThrow("plan Starter");
    expect(() => assertFeature({ plan: defaultPlan("pro") }, "pricing.bulk")).not.toThrow();
  });

  it("límites: permite llegar justo, no pasarse", () => {
    const ctx = { plan: defaultPlan("free") };
    expect(() => assertLimit(ctx, "products", 49)).not.toThrow();
    expect(() => assertLimit(ctx, "products", 50)).toThrow(PlanError);
    expect(() => assertLimit(ctx, "products", 45, 10)).toThrow("hasta 50 productos");
    expect(() => assertLimit({ plan: defaultPlan("pro") }, "products", 10_000)).not.toThrow();
  });

  it("PlanError lleva code 'plan' y nombre para runAction", () => {
    try {
      assertFeature({ plan: defaultPlan("free") }, "audit.log");
    } catch (err) {
      expect(err).toBeInstanceOf(PlanError);
      expect((err as PlanError).name).toBe("PlanError");
      expect((err as PlanError).code).toBe("plan");
    }
  });

  it("featureMinPlan / upgradeMessage", () => {
    expect(featureMinPlan("catalog.variants")).toBe("free");
    expect(featureMinPlan("team.members")).toBe("starter");
    expect(featureMinPlan("domain.custom")).toBe("pro");
    expect(upgradeMessage("theme.custom_css")).toBe("Esta función está disponible desde el plan Pro.");
  });
});

describe("trial y chip", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  it("días restantes redondeados para arriba", () => {
    const plan = { status: "trialing" as const, trialEndsAt: "2026-10-01T11:00:00Z" };
    expect(trialDaysLeft(plan, now)).toBe(9);
    expect(trialDaysLeft({ status: "active", trialEndsAt: null }, now)).toBe(0);
    expect(trialDaysLeft({ status: "trialing", trialEndsAt: "2026-09-01T00:00:00Z" }, now)).toBe(0);
  });
  it("chip", () => {
    expect(getPlanChip({ plan: { name: "Pro", status: "trialing", trialEndsAt: "2026-09-23T13:00:00Z" } }, now)).toEqual({
      label: "Prueba Pro · 2 días",
      tone: "trial",
    });
    expect(getPlanChip({ plan: { name: "Starter", status: "active", trialEndsAt: null } }, now)).toEqual({ label: "Starter", tone: "plan" });
    expect(getPlanChip({ plan: { name: "Pro", status: "past_due", trialEndsAt: null } }, now).tone).toBe("warning");
  });
});
