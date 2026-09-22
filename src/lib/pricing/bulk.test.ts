import { describe, expect, it } from "vitest";

import { applyRounding, computeBulkChange, describeBulkRule, previewBulkUpdate, type BulkAction, type BulkRule } from "./bulk";

function rule(action: BulkAction, extra: Partial<BulkRule> = {}): BulkRule {
  return { action, rounding: "none", roundingDirection: "nearest", min: null, max: null, ...extra };
}

const v = (price: number, compareAtPrice: number | null = null, cost: number | null = null, id = "v1") => ({
  id,
  price,
  compareAtPrice,
  cost,
});

const up10 = { type: "percent", direction: "increase", value: 10, alsoCompareAt: true } as const;
const down10 = { type: "percent", direction: "decrease", value: 10, alsoCompareAt: true } as const;

describe("applyRounding", () => {
  it("sin redondeo sólo normaliza centavos", () => {
    expect(applyRounding(1234.567, "none")).toBe(1234.57);
    expect(applyRounding(0.1 + 0.2, "none")).toBe(0.3);
  });

  it("a 10 / 100 / 1000 al más cercano", () => {
    expect(applyRounding(1234, "to10")).toBe(1230);
    expect(applyRounding(1235, "to10")).toBe(1240);
    expect(applyRounding(1249.99, "to100")).toBe(1200);
    expect(applyRounding(1250, "to100")).toBe(1300);
    expect(applyRounding(12499, "to1000")).toBe(12000);
    expect(applyRounding(12500, "to1000")).toBe(13000);
  });

  it("hacia arriba y hacia abajo", () => {
    expect(applyRounding(1201, "to100", "up")).toBe(1300);
    expect(applyRounding(1200, "to100", "up")).toBe(1200);
    expect(applyRounding(1299.99, "to100", "down")).toBe(1200);
    expect(applyRounding(1300, "to100", "down")).toBe(1300);
  });

  it("nunca redondea un precio positivo a 0", () => {
    expect(applyRounding(40, "to100")).toBe(100);
    expect(applyRounding(40, "to100", "down")).toBe(100);
    expect(applyRounding(499, "to1000")).toBe(1000);
  });

  it("terminar en 990", () => {
    expect(applyRounding(12345, "end990")).toBe(11990); // 11 990 está a 355, 12 990 a 645
    expect(applyRounding(12600, "end990")).toBe(12990);
    expect(applyRounding(12345, "end990", "up")).toBe(12990);
    expect(applyRounding(12345, "end990", "down")).toBe(11990);
    expect(applyRounding(12990, "end990", "up")).toBe(12990);
    expect(applyRounding(12990, "end990", "down")).toBe(12990);
    // Debajo del primer candidato: 990.
    expect(applyRounding(300, "end990")).toBe(990);
    expect(applyRounding(300, "end990", "down")).toBe(990);
  });

  it("terminar en 99", () => {
    expect(applyRounding(1234, "end99")).toBe(1199);
    expect(applyRounding(1260, "end99")).toBe(1299);
    expect(applyRounding(1234, "end99", "up")).toBe(1299);
    expect(applyRounding(1234.5, "end99", "down")).toBe(1199);
    expect(applyRounding(50, "end99")).toBe(99);
  });
});

describe("computeBulkChange — porcentaje y monto", () => {
  it("aumenta un % el precio y el tachado", () => {
    const c = computeBulkChange(v(1000, 1500), rule(up10));
    expect(c).toMatchObject({ newPrice: 1100, newCompareAt: 1650, priceDiff: 100, priceDiffPercent: 10, changed: true });
  });

  it("sin alsoCompareAt deja el tachado como estaba", () => {
    const c = computeBulkChange(v(1000, 1500), rule({ ...up10, alsoCompareAt: false }));
    expect(c.newPrice).toBe(1100);
    expect(c.newCompareAt).toBe(1500);
  });

  it("si el tachado queda ≤ al precio nuevo, se quita", () => {
    const c = computeBulkChange(v(1000, 1050), rule({ ...up10, alsoCompareAt: false }));
    expect(c.newCompareAt).toBeNull();
    expect(c.compareCleared).toBe(true);
  });

  it("baja un %", () => {
    expect(computeBulkChange(v(1000), rule(down10)).newPrice).toBe(900);
    expect(computeBulkChange(v(333.33), rule(down10)).newPrice).toBe(300);
  });

  it("monto fijo, arriba y abajo", () => {
    expect(computeBulkChange(v(1000), rule({ type: "amount", direction: "increase", value: 250, alsoCompareAt: false })).newPrice).toBe(1250);
    expect(computeBulkChange(v(1000, 2000), rule({ type: "amount", direction: "decrease", value: 250, alsoCompareAt: true }))).toMatchObject({
      newPrice: 750,
      newCompareAt: 1750,
    });
  });

  it("negativos: bajar más que el precio se omite (no queda en 0)", () => {
    const amount = computeBulkChange(v(1000), rule({ type: "amount", direction: "decrease", value: 1000, alsoCompareAt: false }));
    expect(amount).toMatchObject({ skipped: "non_positive", changed: false, newPrice: 1000 });
    const pct = computeBulkChange(v(1000), rule({ ...down10, value: 100 }));
    expect(pct.skipped).toBe("non_positive");
    const more = computeBulkChange(v(1000), rule({ type: "amount", direction: "decrease", value: 5000, alsoCompareAt: false }));
    expect(more.skipped).toBe("non_positive");
  });

  it("con piso, bajar de más queda en el piso", () => {
    const c = computeBulkChange(v(1000), rule({ type: "amount", direction: "decrease", value: 5000, alsoCompareAt: false }, { min: 500 }));
    expect(c).toMatchObject({ newPrice: 500, clamped: "min", skipped: null });
  });

  it("redondeo después del cálculo", () => {
    // 1234 × 1.1 = 1357.4 → a 100 = 1400
    expect(computeBulkChange(v(1234), rule(up10, { rounding: "to100" })).newPrice).toBe(1400);
    // → terminar en 990 hacia arriba = 1990
    expect(computeBulkChange(v(1234), rule(up10, { rounding: "end990", roundingDirection: "up" })).newPrice).toBe(1990);
    // el tachado también se redondea: 1500 × 1.1 = 1650 → 1700
    expect(computeBulkChange(v(1234, 1500), rule(up10, { rounding: "to100" })).newCompareAt).toBe(1700);
  });

  it("tope: no superar / no bajar de, aplicado después del redondeo y exacto", () => {
    const max = computeBulkChange(v(10000), rule(up10, { rounding: "to1000", max: 10500 }));
    expect(max).toMatchObject({ newPrice: 10500, clamped: "max" });
    const min = computeBulkChange(v(1000), rule(down10, { min: 950 }));
    expect(min).toMatchObject({ newPrice: 950, clamped: "min" });
    const inside = computeBulkChange(v(1000), rule(up10, { min: 500, max: 5000 }));
    expect(inside).toMatchObject({ newPrice: 1100, clamped: null });
  });

  it("si el resultado es igual al actual, no cambia", () => {
    const c = computeBulkChange(v(1000), rule(up10, { max: 1000 }));
    expect(c.changed).toBe(false);
    expect(c.skipped).toBeNull();
  });
});

describe("computeBulkChange — margen, tachado y ofertas", () => {
  it("precio = costo × (1 + margen)", () => {
    expect(computeBulkChange(v(1000, null, 800), rule({ type: "margin", marginPercent: 50 })).newPrice).toBe(1200);
    expect(computeBulkChange(v(1000, null, 333), rule({ type: "margin", marginPercent: 35 }, { rounding: "to10" })).newPrice).toBe(450);
  });

  it("margen sin costo se omite", () => {
    expect(computeBulkChange(v(1000), rule({ type: "margin", marginPercent: 50 })).skipped).toBe("no_cost");
    expect(computeBulkChange(v(1000, null, 0), rule({ type: "margin", marginPercent: 50 })).skipped).toBe("no_cost");
  });

  it("margen que deja el tachado por debajo lo quita", () => {
    const c = computeBulkChange(v(1000, 1300, 1000), rule({ type: "margin", marginPercent: 40 }));
    expect(c).toMatchObject({ newPrice: 1400, newCompareAt: null, compareCleared: true });
  });

  it("tachado = precio × (1 + %)", () => {
    const c = computeBulkChange(v(1000), rule({ type: "compare_from_price", percent: 25 }));
    expect(c).toMatchObject({ newPrice: 1000, newCompareAt: 1250, priceDiff: 0, changed: true });
  });

  it("tachado con tope y redondeo; si no queda por encima del precio se omite", () => {
    expect(computeBulkChange(v(1000), rule({ type: "compare_from_price", percent: 25 }, { rounding: "to100" })).newCompareAt).toBe(1300);
    expect(computeBulkChange(v(1000), rule({ type: "compare_from_price", percent: 25 }, { max: 1200 }))).toMatchObject({
      newCompareAt: 1200,
      clamped: "max",
    });
    const clampedBelow = computeBulkChange(v(1000), rule({ type: "compare_from_price", percent: 25 }, { max: 900 }));
    expect(clampedBelow.skipped).toBe("compare_not_above");
    const rounded = computeBulkChange(v(1000), rule({ type: "compare_from_price", percent: 5 }, { rounding: "to1000" }));
    expect(rounded.skipped).toBe("compare_not_above");
  });

  it("quitar tachado", () => {
    expect(computeBulkChange(v(1000, 1500), rule({ type: "clear_compare" }))).toMatchObject({
      newCompareAt: null,
      newPrice: 1000,
      changed: true,
    });
    expect(computeBulkChange(v(1000), rule({ type: "clear_compare" })).changed).toBe(false);
  });

  it("oferta: copia el precio al tachado y aplica el descuento", () => {
    const c = computeBulkChange(v(10000, 12000), rule({ type: "sale_from_price", discountPercent: 20 }, { rounding: "end990", roundingDirection: "down" }));
    expect(c).toMatchObject({ newPrice: 7990, newCompareAt: 10000, priceDiff: -2010, changed: true });
  });

  it("oferta de 100 % o que redondea hacia arriba al mismo precio se omite", () => {
    expect(computeBulkChange(v(1000), rule({ type: "sale_from_price", discountPercent: 100 })).skipped).toBe("non_positive");
    expect(
      computeBulkChange(v(1000), rule({ type: "sale_from_price", discountPercent: 1 }, { rounding: "to1000", roundingDirection: "up" })).skipped,
    ).toBe("compare_not_above");
    expect(computeBulkChange(v(0), rule({ type: "sale_from_price", discountPercent: 10 })).skipped).toBe("non_positive");
  });
});

describe("previewBulkUpdate", () => {
  const variants = [v(1000, null, 500, "a"), v(2000, 2500, null, "b"), v(3000, null, 1000, "c")];

  it("devuelve una fila por variante en orden y conserva el objeto original", () => {
    const { rows } = previewBulkUpdate(variants, rule(up10));
    expect(rows.map((r) => r.variant.id)).toEqual(["a", "b", "c"]);
    expect(rows[1].variant).toBe(variants[1]);
  });

  it("resume cambios, omitidas y variación", () => {
    const { summary } = previewBulkUpdate(variants, rule(up10));
    expect(summary).toMatchObject({ total: 3, changed: 3, skipped: 0, unchanged: 0, oldTotal: 6000, newTotal: 6600, changePercent: 10 });
    const margin = previewBulkUpdate(variants, rule({ type: "margin", marginPercent: 100 }));
    // a: 500 → 1000 (sin cambio), b: sin costo, c: 1000 → 2000
    expect(margin.summary).toMatchObject({ total: 3, changed: 1, skipped: 1, unchanged: 1, oldTotal: 3000, newTotal: 2000, changePercent: -33.33 });
  });

  it("cuenta las filas recortadas por el tope", () => {
    const { summary } = previewBulkUpdate(variants, rule(up10, { max: 2000 }));
    // a: 1100, b: 2000 (tope → igual al actual → no cambia el precio pero sí el tachado), c: 2000 (tope)
    expect(summary.clamped).toBe(2);
  });

  it("lista vacía", () => {
    expect(previewBulkUpdate([], rule(up10)).summary).toMatchObject({ total: 0, changed: 0, changePercent: 0 });
  });
});

describe("describeBulkRule", () => {
  // Normaliza espacios (formatMoney/formatPercent usan espacios irrompibles).
  const d = (r: BulkRule) => describeBulkRule(r).replace(/\s/g, " ");

  it("resume la regla en una línea", () => {
    expect(d(rule(up10, { rounding: "to100", max: 50000 }))).toBe(
      "Aumentar 10 % (también el tachado) · redondeo a 100 al más cercano · no superar $ 50.000",
    );
    expect(d(rule({ type: "clear_compare" }, { rounding: "to100", min: 10 }))).toBe("Quitar precio tachado");
    expect(d(rule({ type: "sale_from_price", discountPercent: 15 }))).toBe("Oferta: tachar el precio actual y bajar 15 %");
    expect(d(rule({ type: "margin", marginPercent: 40 }, { rounding: "end990", roundingDirection: "up", min: 1000 }))).toBe(
      "Precio = costo + 40 % de margen · redondeo terminar en 990 hacia arriba · no bajar de $ 1.000",
    );
  });
});
