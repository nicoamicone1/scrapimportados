import { describe, expect, it } from "vitest";

import { EMPTY_PROMOTION, promotionSchema } from "./promotion";

const base = { ...EMPTY_PROMOTION, name: "Promo" };
const paths = (input: unknown) => {
  const r = promotionSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("promotionSchema · Llevá X, pagá Y", () => {
  it("acepta 3x2, 2x1 y 4x3 sin valor", () => {
    for (const [buy, pay] of [
      [3, 2],
      [2, 1],
      [4, 3],
    ])
      expect(promotionSchema.safeParse({ ...base, type: "bxgy", value: 0, buy, pay }).success).toBe(true);
  });
  it("pagá tiene que ser menor que llevá; enteros ≥ 1", () => {
    expect(paths({ ...base, type: "bxgy", value: 0, buy: 2, pay: 2 })).toEqual(["pay"]);
    expect(paths({ ...base, type: "bxgy", value: 0, buy: 3, pay: 0 })).toContain("pay");
    expect(paths({ ...base, type: "bxgy", value: 0, buy: 2.5, pay: 1 })).toContain("buy");
    expect(paths({ ...base, type: "bxgy", value: 0, buy: 1, pay: null })).toEqual(expect.arrayContaining(["buy", "pay"]));
    expect(paths({ ...base, type: "bxgy", value: 0, buy: null, pay: 2 })).toContain("buy");
  });
});

describe("promotionSchema · N.ª unidad con descuento", () => {
  it("acepta la 2.ª al 50 % y la 3.ª gratis", () => {
    expect(promotionSchema.safeParse({ ...base, type: "nth_unit_percent", value: 50, nth: 2 }).success).toBe(true);
    expect(promotionSchema.safeParse({ ...base, type: "nth_unit_percent", value: 100, nth: 3 }).success).toBe(true);
  });
  it("porcentaje de 1 a 100 y desde la 2.ª unidad", () => {
    expect(paths({ ...base, type: "nth_unit_percent", value: 0, nth: 2 })).toEqual(["value"]);
    expect(paths({ ...base, type: "nth_unit_percent", value: 120, nth: 2 })).toEqual(["value"]);
    expect(paths({ ...base, type: "nth_unit_percent", value: 50, nth: 1 })).toEqual(["nth"]);
    expect(paths({ ...base, type: "nth_unit_percent", value: 50, nth: null })).toEqual(["nth"]);
  });
});

describe("promotionSchema · por unidad", () => {
  it("porcentaje y monto siguen pidiendo valor > 0", () => {
    expect(paths({ ...base, type: "percent", value: 0 })).toEqual(["value"]);
    expect(paths({ ...base, type: "fixed", value: 0 })).toEqual(["value"]);
    expect(promotionSchema.safeParse({ ...base, type: "fixed", value: 500 }).success).toBe(true);
  });
});
