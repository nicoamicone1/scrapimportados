import { describe, expect, it } from "vitest";

import { parsePlan } from "./index";
import {
  billingPeriodArg,
  billingPeriodLabel,
  monthlyEquivalent,
  planWithPeriod,
  validYearlyOffer,
  yearlyLine,
  yearlyMonthsPaid,
  yearlyOffer,
  yearlyPriceProblem,
  yearlySavingsPercent,
} from "./yearly";

describe("pago anual", () => {
  it("ahorro: 1 − anual / (mensual × 12), en % entero", () => {
    expect(yearlySavingsPercent(14999, 149990)).toBe(17); // 10 de 12 meses = 16,67 %
    expect(yearlySavingsPercent(34999, 349990)).toBe(17);
    expect(yearlySavingsPercent(10000, 108000)).toBe(10);
    // Sin anual, sin mensual o sin ahorro: null.
    expect(yearlySavingsPercent(14999, null)).toBeNull();
    expect(yearlySavingsPercent(null, 149990)).toBeNull();
    expect(yearlySavingsPercent(0, 149990)).toBeNull();
    expect(yearlySavingsPercent(10000, 120000)).toBeNull();
    expect(yearlySavingsPercent(10000, 130000)).toBeNull();
    expect(yearlySavingsPercent(10000, 0)).toBeNull();
  });

  it("equivalente mensual: anual / 12 en pesos enteros", () => {
    expect(monthlyEquivalent(149990)).toBe(12499); // 12.499,17
    expect(monthlyEquivalent(349990)).toBe(29166); // 29.165,83
    expect(monthlyEquivalent(120000)).toBe(10000);
    expect(monthlyEquivalent(null)).toBeNull();
    expect(monthlyEquivalent(0)).toBeNull();
    expect(monthlyEquivalent(Number.NaN)).toBeNull();
  });

  it("'12 meses por el precio de 10' sólo si da justo; si no, el %", () => {
    expect(yearlyMonthsPaid(14999, 149990)).toBe(10);
    expect(yearlyMonthsPaid(14999, 149995)).toBe(10); // redondeo de hasta 1 peso por mes
    expect(yearlyMonthsPaid(14999, 150100)).toBeNull();
    expect(yearlyMonthsPaid(10000, 120000)).toBeNull(); // 12 meses: no es oferta
    expect(yearlyOffer(14999, 149990)).toBe("12 meses por el precio de 10");
    expect(yearlyOffer(10000, 110000)).toBe("12 meses por el precio de 11");
    expect(yearlyOffer(10000, 105000)).toBe("ahorrás 13 %");
    expect(yearlyOffer(10000, 125000)).toBeNull();
    expect(yearlyOffer(null, 125000)).toBeNull();
  });

  it("línea bajo el precio mensual", () => {
    expect(yearlyLine({ priceMonthly: 14999, priceYearly: 149990, currency: "ARS" })).toBe(
      "Pagando el año: 12 meses por el precio de 10 · $ 12.499 por mes",
    );
    expect(yearlyLine({ priceMonthly: 10000, priceYearly: 105000, currency: "ARS" })).toBe("Pagando el año: ahorrás 13 % · $ 8.750 por mes");
    // Sin mensual, sin ahorro o con un ahorro increíble (> 60 %): no se ofrece.
    expect(yearlyLine({ priceMonthly: null, priceYearly: 120000, currency: "ARS" })).toBeNull();
    expect(yearlyLine({ priceMonthly: 10000, priceYearly: 120000, currency: "ARS" })).toBeNull();
    expect(yearlyLine({ priceMonthly: 10000, priceYearly: 130000, currency: "ARS" })).toBeNull();
    expect(yearlyLine({ priceMonthly: 14999, priceYearly: 14999, currency: "ARS" })).toBeNull(); // el mensual cargado como anual
    expect(yearlyLine({ priceMonthly: 14999, priceYearly: null, currency: "ARS" })).toBeNull();
  });

  it("bordes del anual: menos que 12 meses y no más de 60 % de ahorro", () => {
    // 12 meses justos o más: no ahorra.
    expect(yearlyPriceProblem(10000, 120000)).toMatch(/menor que 12 meses/);
    expect(yearlyPriceProblem(10000, 119999)).toBeNull();
    // 60 % de ahorro = 4,8 meses: sirve; un peso menos, no.
    expect(yearlyPriceProblem(10000, 48000)).toBeNull();
    expect(yearlyPriceProblem(10000, 47999)).toMatch(/60/);
    // Menos que un mes (dato mal cargado).
    expect(yearlyPriceProblem(10000, 9000)).toMatch(/menor que un mes/);
    // Sin precio mensual (a medida o Free) o sin anual.
    expect(yearlyPriceProblem(null, 100000)).toMatch(/precio por mes/);
    expect(yearlyPriceProblem(0, 100000)).toMatch(/precio por mes/);
    expect(yearlyPriceProblem(10000, 0)).toMatch(/mayor que cero/);
    expect(yearlyPriceProblem(10000, Number.NaN)).toMatch(/mayor que cero/);
    expect(validYearlyOffer(14999, 149990)).toBe(149990);
    expect(validYearlyOffer(14999, 14999)).toBeNull();
    expect(validYearlyOffer(10000, 120000)).toBeNull();
    // El % y "12 meses por el precio de N" siguen la misma regla.
    expect(yearlySavingsPercent(10000, 30000)).toBeNull(); // 75 %: dato inválido
    expect(yearlyMonthsPaid(10000, 30000)).toBeNull(); // no "12 meses por el precio de 3"
    expect(yearlyOffer(10000, 48000)).toMatch(/^ahorrás 60.%$/);
  });

  it("billingPeriodArg: sólo el anual manda p_billing_period", () => {
    expect(billingPeriodArg("monthly")).toEqual({});
    expect(billingPeriodArg(null)).toEqual({});
    expect(billingPeriodArg(undefined)).toEqual({});
    expect(billingPeriodArg("yearly")).toEqual({ p_billing_period: "yearly" });
  });

  it("etiquetas", () => {
    expect(billingPeriodLabel("monthly")).toBe("mensual");
    expect(billingPeriodLabel("yearly")).toBe("anual");
    expect(planWithPeriod("Pro", "yearly")).toBe("Pro anual");
    expect(planWithPeriod("Pro", "monthly")).toBe("Pro");
  });

  it("parsePlan: price_yearly y billing_period (sin 0019 → sin anual, mensual)", () => {
    const p = parsePlan({ code: "pro", status: "active", price_monthly: "34999.00", price_yearly: "349990.00", billing_period: "yearly" });
    expect(p.priceYearly).toBe(349990);
    expect(p.billingPeriod).toBe("yearly");
    const legacy = parsePlan({ code: "pro", status: "active", price_monthly: 34999 });
    expect(legacy.priceYearly).toBeNull();
    expect(legacy.billingPeriod).toBe("monthly");
    // Free y la prueba son siempre mensuales; basura → mensual.
    expect(parsePlan({ code: "free", billing_period: "yearly" }).billingPeriod).toBe("monthly");
    expect(parsePlan({ code: "pro", status: "trialing", billing_period: "yearly" }).billingPeriod).toBe("monthly");
    expect(parsePlan({ code: "pro", status: "active", billing_period: "semanal", price_yearly: 0 })).toMatchObject({ billingPeriod: "monthly", priceYearly: null });
  });
});
