import { describe, expect, it } from "vitest";

import { couponSchema, EMPTY_COUPON, generateCouponCode, normalizeCouponCode } from "./coupon";
import { bulkRuleSchema, DEFAULT_RULE, DEFAULT_SCOPE, priceScopeSchema } from "./price-update";
import { EMPTY_PROMOTION, promotionSchema } from "./promotion";

describe("promotionSchema", () => {
  it("acepta la promo vacía con nombre", () => {
    expect(promotionSchema.safeParse({ ...EMPTY_PROMOTION, name: "Semana" }).success).toBe(true);
  });
  it("valida %, alcance, fechas y etiqueta", () => {
    const bad = promotionSchema.safeParse({
      ...EMPTY_PROMOTION,
      name: "X",
      value: 150,
      scope: "categories",
      startsAt: "2026-10-10T00:00",
      endsAt: "2026-10-01T00:00",
      badgeLabel: "Oferta \u{1F525}",
    });
    expect(bad.success).toBe(false);
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["value", "categoryIds", "endsAt", "badgeLabel"]));
  });
  it("etiqueta de hasta 16 caracteres", () => {
    expect(promotionSchema.safeParse({ ...EMPTY_PROMOTION, name: "X", badgeLabel: "Semana del Hogar" }).success).toBe(true);
    expect(promotionSchema.safeParse({ ...EMPTY_PROMOTION, name: "X", badgeLabel: "Semana del Hogar!" }).success).toBe(false);
  });
});

describe("couponSchema", () => {
  it("normaliza el código a mayúsculas y sin espacios ni acentos", () => {
    expect(normalizeCouponCode(" bienvenido 10 ")).toBe("BIENVENIDO10");
    expect(normalizeCouponCode("Año-Nuevo")).toBe("ANO-NUEVO");
    expect(couponSchema.parse({ ...EMPTY_COUPON, code: "hola2026" }).code).toBe("HOLA2026");
  });
  it("envío gratis fuerza valor 0; % entre 1 y 100; fijo > 0", () => {
    expect(couponSchema.parse({ ...EMPTY_COUPON, code: "ENVIO", type: "free_shipping", value: 50 }).value).toBe(0);
    expect(couponSchema.safeParse({ ...EMPTY_COUPON, code: "X1", value: 0 }).success).toBe(false);
    expect(couponSchema.safeParse({ ...EMPTY_COUPON, code: "X1", value: 101 }).success).toBe(false);
    expect(couponSchema.safeParse({ ...EMPTY_COUPON, code: "X1", type: "fixed", value: 0 }).success).toBe(false);
  });
  it("usos por cliente no superan los totales", () => {
    expect(couponSchema.safeParse({ ...EMPTY_COUPON, code: "X1", maxUses: 1, maxUsesPerCustomer: 2 }).success).toBe(false);
  });
  it("código inválido", () => {
    expect(couponSchema.safeParse({ ...EMPTY_COUPON, code: "!" }).success).toBe(false);
  });
  it("genera códigos legibles", () => {
    expect(generateCouponCode(10)).toMatch(/^[A-HJ-KM-NP-Z2-9]{10}$/);
  });
});

describe("price-update schemas", () => {
  it("defaults válidos", () => {
    expect(priceScopeSchema.safeParse(DEFAULT_SCOPE).success).toBe(true);
    expect(bulkRuleSchema.safeParse(DEFAULT_RULE).success).toBe(true);
  });
  it("alcances incompletos", () => {
    expect(priceScopeSchema.safeParse({ ...DEFAULT_SCOPE, kind: "categories" }).success).toBe(false);
    expect(priceScopeSchema.safeParse({ ...DEFAULT_SCOPE, kind: "price_range" }).success).toBe(false);
    expect(priceScopeSchema.safeParse({ ...DEFAULT_SCOPE, kind: "price_range", minPrice: 10, maxPrice: 5 }).success).toBe(false);
    expect(priceScopeSchema.safeParse({ ...DEFAULT_SCOPE, kind: "price_range", maxPrice: 5000 }).success).toBe(true);
  });
  it("reglas inválidas", () => {
    const pct = (value: number, direction: "increase" | "decrease") => ({
      ...DEFAULT_RULE,
      action: { type: "percent", direction, value, alsoCompareAt: false },
    });
    expect(bulkRuleSchema.safeParse(pct(100, "decrease")).success).toBe(false);
    expect(bulkRuleSchema.safeParse(pct(0, "increase")).success).toBe(false);
    expect(bulkRuleSchema.safeParse(pct(150, "increase")).success).toBe(true);
    expect(bulkRuleSchema.safeParse({ ...DEFAULT_RULE, min: 100, max: 50 }).success).toBe(false);
    expect(bulkRuleSchema.safeParse({ ...DEFAULT_RULE, action: { type: "sale_from_price", discountPercent: 100 } }).success).toBe(false);
  });
});
