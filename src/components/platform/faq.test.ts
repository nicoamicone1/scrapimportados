import { describe, expect, it } from "vitest";

import { PLAN_CODES, PLAN_DEFAULTS, PLAN_NAMES } from "@/lib/plans";

import { pickFaq, platformFaq, type FaqPlan } from "./faq";

const base = PLAN_CODES.map((code) => ({ code, name: PLAN_NAMES[code], features: PLAN_DEFAULTS[code].features, priceMonthly: PLAN_DEFAULTS[code].price }));
const withYearly = (yearly: Partial<Record<(typeof PLAN_CODES)[number], number>>): FaqPlan[] =>
  base.map((p) => ({ ...p, priceYearly: yearly[p.code] ?? null }));

const answer = (plans: readonly FaqPlan[] | undefined, id: "anual" | "cambio-plan", mpEnabled?: boolean) =>
  pickFaq(platformFaq({ storeAddress: "x", plans, mpEnabled }), [id])[0]?.a ?? null;

describe("faq: pago anual y MercadoPago", () => {
  it("«¿Puedo pagar el año?» sale de los planes con anual; sin ninguno, no aparece", () => {
    expect(answer(undefined, "anual")).toBeNull();
    expect(answer(base, "anual")).toBeNull();
    const starter = PLAN_DEFAULTS.starter.price ?? 0;
    const pro = PLAN_DEFAULTS.pro.price ?? 0;
    expect(answer(withYearly({ starter: starter * 10, pro: pro * 10 }), "anual")).toMatch(/^Sí, en Starter y Pro: pagás 12 meses por el precio de 10, por transferencia,/);
    expect(answer(withYearly({ pro: pro * 10 }), "anual")).toMatch(/^Sí, en Pro:/);
    // Meses distintos: sin cifra.
    expect(answer(withYearly({ starter: starter * 10, pro: pro * 11 }), "anual")).toMatch(/pagás el año por adelantado, con descuento/);
    // Un anual que no ahorra no cuenta.
    expect(answer(withYearly({ starter: starter * 12 }), "anual")).toBeNull();
  });

  it("MercadoPago sólo si el cobro está prendido", () => {
    const plans = withYearly({ pro: (PLAN_DEFAULTS.pro.price ?? 0) * 10 });
    expect(answer(plans, "anual")).not.toMatch(/MercadoPago/);
    expect(answer(plans, "cambio-plan")).not.toMatch(/MercadoPago/);
    expect(answer(plans, "cambio-plan")).toMatch(/WhatsApp/);
    expect(answer(plans, "anual", true)).toMatch(/por transferencia o con MercadoPago/);
    expect(answer(plans, "cambio-plan", true)).toMatch(/MercadoPago \(débito automático\)/);
  });

  it("sin porcentajes ni ids repetidos con el anual", () => {
    const faq = platformFaq({ storeAddress: "x", plans: withYearly({ starter: 1, pro: (PLAN_DEFAULTS.pro.price ?? 0) * 11 }), mpEnabled: true });
    expect(new Set(faq.map((f) => f.id)).size).toBe(faq.length);
    for (const f of faq) expect(`${f.q} ${f.a}`).not.toMatch(/\d+ ?%/);
  });
});
