import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/supabase/server", () => ({ createPublicClient: () => null }));

import { planPriceLabel, toPublicPlan } from "./catalog";

const row = (patch: Record<string, unknown>) => ({ code: "pro", name: "Pro", description: null, position: 3, currency: "ARS", ...patch });

describe("catálogo público", () => {
  it("planPriceLabel: mensual, anual y un anual sin precio anual (nunca «/ mes»)", () => {
    const pro = { priceMonthly: 34999, priceYearly: 349990, currency: "ARS" };
    expect(planPriceLabel(pro)).toEqual({ amount: "$ 34.999", suffix: "/ mes" });
    expect(planPriceLabel(pro, "yearly")).toEqual({ amount: "$ 349.990", suffix: "/ año" });
    const noYearly = planPriceLabel({ ...pro, priceYearly: null }, "yearly");
    expect(noYearly.suffix).not.toMatch(/mes/);
    expect(noYearly).toEqual({ amount: "Pago anual", suffix: "" });
    expect(planPriceLabel({ priceMonthly: null, currency: "ARS" })).toEqual({ amount: "A medida", suffix: "" });
    expect(planPriceLabel({ priceMonthly: 0, currency: "ARS" })).toEqual({ amount: "Gratis", suffix: "para siempre" });
  });

  it("toPublicPlan: un anual que no ahorra, o que ahorra más del 60 %, no se ofrece", () => {
    expect(toPublicPlan(row({ price_monthly: 34999, price_yearly: 349990 }))).toMatchObject({
      priceYearly: 349990,
      yearlySavingsPercent: 17,
      monthlyEquivalent: 29166,
    });
    for (const price_yearly of [34999 * 12, 500000, 34999, 100000, null]) {
      expect(toPublicPlan(row({ price_monthly: 34999, price_yearly }))).toMatchObject({
        priceYearly: null,
        yearlySavingsPercent: null,
        monthlyEquivalent: null,
      });
    }
    // Business (a medida) con un anual cargado: tampoco.
    expect(toPublicPlan(row({ code: "business", price_monthly: null, price_yearly: 500000 })).priceYearly).toBeNull();
  });
});
