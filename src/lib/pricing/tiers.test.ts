import { describe, expect, it } from "vitest";

import { applyPromotions, computeCart } from "./engine";
import { normalizePriceTiers, priceTiersToRows, supportsPriceTiers, tierFor, tierPriceFor, tierRangeLabel, tierSavingsPercent } from "./tiers";
import type { CartItemInput, Coupon, PriceTier, Promotion } from "./types";

const NOW = new Date("2026-09-22T12:00:00Z");

/** Desde 6 u. $ 900, desde 12 u. $ 800 (lista $ 1.000). */
const TIERS: PriceTier[] = [
  { minQty: 6, price: 900 },
  { minQty: 12, price: 800 },
];

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "p1",
    name: "Promo",
    type: "percent",
    value: 10,
    scope: "all",
    categoryIds: [],
    productIds: [],
    startsAt: null,
    endsAt: null,
    isActive: true,
    priority: 0,
    badgeLabel: null,
    stackable: false,
    ...overrides,
  };
}

const bxgy = (overrides: Partial<Promotion> = {}) => promo({ id: "q3x2", name: "3x2", type: "bxgy", value: 0, buy: 3, pay: 2, ...overrides });

function item(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return { variantId: "var-a", productId: "prod-a", categoryIds: [], qty: 1, listPrice: 1000, priceTiers: TIERS, ...overrides };
}

describe("tramos: helpers", () => {
  it("normaliza el jsonb de la DB y descarta lo inválido", () => {
    expect(normalizePriceTiers([{ min_qty: 12, price: "800" }, { min_qty: 6, price: 900 }])).toEqual(TIERS);
    // min_qty < 2, no entero, precio 0, precio que no baja: afuera.
    expect(
      normalizePriceTiers([
        { min_qty: 1, price: 950 },
        { min_qty: 6.5, price: 900 },
        { min_qty: 6, price: 0 },
        { min_qty: 6, price: 900 },
        { min_qty: 10, price: 950 },
        { min_qty: 12, price: 800 },
      ]),
    ).toEqual(TIERS);
    expect(normalizePriceTiers(null)).toEqual([]);
    expect(normalizePriceTiers("[]")).toEqual([]);
    // Formato del carrito (camelCase) también.
    expect(normalizePriceTiers([{ minQty: 6, price: 900 }])).toEqual([{ minQty: 6, price: 900 }]);
    expect(priceTiersToRows(TIERS)).toEqual([
      { min_qty: 6, price: 900 },
      { min_qty: 12, price: 800 },
    ]);
  });

  it("elige el tramo de mayor cantidad alcanzada y nunca sube el precio", () => {
    expect(tierFor(TIERS, 5)).toBeNull();
    expect(tierFor(TIERS, 6)?.minQty).toBe(6);
    expect(tierFor(TIERS, 11)?.minQty).toBe(6);
    expect(tierFor(TIERS, 12)?.minQty).toBe(12);
    expect(tierPriceFor(TIERS, 12, 1000)).toBe(800);
    // Variante más barata que el tramo: queda con su precio.
    expect(tierPriceFor(TIERS, 6, 850)).toBe(850);
    expect(tierPriceFor([], 50, 1000)).toBe(1000);
  });

  it("etiquetas, ahorro y versión del esquema", () => {
    expect(tierRangeLabel(1, 5)).toBe("1–5");
    expect(tierRangeLabel(12, null)).toBe("12 o más");
    expect(tierSavingsPercent(1000, 900)).toBe(10);
    expect(tierSavingsPercent(999, 899)).toBe(10);
    expect(tierSavingsPercent(1000, 1000)).toBe(0);
    expect(supportsPriceTiers(12)).toBe(true);
    expect(supportsPriceTiers(11)).toBe(false);
    expect(supportsPriceTiers(null)).toBe(false);
  });
});

describe("tramos: carrito", () => {
  it.each([
    [1, 1000, 1000, 0],
    [5, 1000, 5000, 0],
    [6, 900, 5400, 600],
    [11, 900, 9900, 1100],
    [12, 800, 9600, 2400],
  ])("%i unidades → $ %i c/u", (qty, unit, total, saved) => {
    const t = computeCart({ items: [item({ qty })], now: NOW });
    const [line] = t.lines;
    expect(line.listPrice).toBe(1000);
    expect(line.unitPrice).toBe(unit);
    expect(line.tierApplied).toEqual(unit < 1000 ? { minQty: qty >= 12 ? 12 : 6, price: unit } : null);
    expect(t.subtotal).toBe(1000 * qty);
    expect(t.tierDiscount).toBe(saved);
    expect(t.promoTotal).toBe(saved);
    expect(t.total).toBe(total);
  });

  it("dos variantes del mismo producto suman para el tramo (regla por producto)", () => {
    const t = computeCart({
      items: [item({ variantId: "talle-s", qty: 3 }), item({ variantId: "talle-m", qty: 3 })],
      now: NOW,
    });
    expect(t.lines.map((l) => l.unitPrice)).toEqual([900, 900]);
    expect(t.total).toBe(5400);
    // Otro producto no suma.
    const other = computeCart({
      items: [item({ qty: 3 }), item({ variantId: "var-b", productId: "prod-b", qty: 3, priceTiers: [] })],
      now: NOW,
    });
    expect(other.lines.map((l) => l.unitPrice)).toEqual([1000, 1000]);
  });

  it("una variante más barata que el tramo conserva su precio (y suma unidades)", () => {
    const t = computeCart({
      items: [item({ variantId: "grande", qty: 4 }), item({ variantId: "chica", qty: 2, listPrice: 850 })],
      now: NOW,
    });
    expect(t.lines[0].unitPrice).toBe(900);
    expect(t.lines[1].unitPrice).toBe(850);
    expect(t.lines[1].tierApplied).toBeNull();
    expect(t.total).toBe(4 * 900 + 2 * 850);
  });

  it("promo % por unidad se calcula sobre el precio del tramo", () => {
    const t = computeCart({ items: [item({ qty: 6 })], promotions: [promo({ value: 10 })], now: NOW });
    expect(t.lines[0].unitPrice).toBe(810);
    expect(t.lines[0].promotion?.amount).toBe(90);
    expect(t.tierDiscount).toBe(600);
    expect(t.promoTotal).toBe(6000 - 6 * 810);
    expect(t.total).toBe(4860);
  });

  it("3x2 encima del tramo: bonifica unidades a precio de tramo", () => {
    const t = computeCart({ items: [item({ qty: 6 })], promotions: [bxgy()], now: NOW });
    expect(t.lines[0].unitPrice).toBe(900);
    expect(t.bundleDiscount).toBe(1800);
    expect(t.promoTotal).toBe(600 + 1800);
    expect(t.total).toBe(3600);
  });

  it("3x2 que le gana a una promo por unidad: la línea vuelve al precio del tramo, no al de lista", () => {
    const t = computeCart({
      items: [item({ qty: 6 })],
      promotions: [promo({ id: "p20", value: 20, priority: 0 }), bxgy({ priority: 1 })],
      now: NOW,
    });
    expect(t.lines[0].promotion).toBeNull();
    expect(t.lines[0].unitPrice).toBe(900);
    expect(t.bundleDiscount).toBe(1800);
    expect(t.total).toBe(3600);
  });

  it("2.ª unidad al 50 % se calcula sobre el precio del tramo", () => {
    const nth = promo({ id: "q2da", name: "2.ª al 50", type: "nth_unit_percent", value: 50, nth: 2 });
    const t = computeCart({ items: [item({ qty: 6 })], promotions: [nth], now: NOW });
    const [line] = t.lines;
    expect(line.unitPrice).toBe(900);
    expect(line.tierApplied).toEqual({ minQty: 6, price: 900 });
    // 3 grupos de 2: una unidad por grupo a mitad del precio del tramo ($ 450).
    expect(t.bundleDiscount).toBe(3 * 450);
    expect(t.tierDiscount).toBe(600);
    expect(t.promoTotal).toBe(600 + 1350);
    expect(t.total).toBe(5400 - 1350);
  });

  it("promo por unidad acumulable + 3x2 acumulable: las dos sobre el precio del tramo", () => {
    const t = computeCart({
      items: [item({ qty: 6 })],
      promotions: [promo({ value: 10, stackable: true }), bxgy({ stackable: true })],
      now: NOW,
    });
    const [line] = t.lines;
    // Tramo $ 900 − 10 % = $ 810; el 3x2 bonifica 2 unidades a $ 810.
    expect(line.unitPrice).toBe(810);
    expect(line.promotion?.amount).toBe(90);
    expect(line.tierApplied).toEqual({ minQty: 6, price: 900 });
    expect(t.bundleDiscount).toBe(2 * 810);
    expect(t.tierDiscount).toBe(600);
    expect(t.promoTotal).toBe(6000 - (6 * 810 - 1620));
    expect(t.total).toBe(6 * 810 - 1620);
  });

  it("dos productos con tramos: sólo baja el que alcanza su cantidad", () => {
    const t = computeCart({
      items: [
        item({ qty: 6 }),
        item({ variantId: "var-b", productId: "prod-b", qty: 3, listPrice: 500, priceTiers: [{ minQty: 5, price: 450 }] }),
      ],
      now: NOW,
    });
    const [a, b] = t.lines;
    expect(a.unitPrice).toBe(900);
    expect(a.tierApplied).toEqual({ minQty: 6, price: 900 });
    expect(b.unitPrice).toBe(500);
    expect(b.tierApplied).toBeNull();
    expect(t.tierDiscount).toBe(600);
    expect(t.subtotal).toBe(6000 + 1500);
    expect(t.total).toBe(5400 + 1500);
  });

  it("compare_at no participa del tramo", () => {
    const t = computeCart({ items: [item({ qty: 6, compareAtPrice: 1500 })], now: NOW });
    expect(t.lines[0].unitPrice).toBe(900);
    expect(t.subtotal).toBe(6000);
    expect(t.total).toBe(5400);
  });

  it("el cupón va después del tramo", () => {
    const coupon: Coupon = { code: "HOLA", type: "percent", value: 10, minSubtotal: null, scope: "all", categoryIds: [], productIds: [], isActive: true };
    const t = computeCart({ items: [item({ qty: 6 })], coupon, now: NOW });
    expect(t.couponDiscount).toBe(540);
    expect(t.merchandiseTotal).toBe(4860);
    // El mínimo del cupón mira el total ya con el tramo.
    const min = computeCart({ items: [item({ qty: 6 })], coupon: { ...coupon, minSubtotal: 5500 }, now: NOW });
    expect(min.coupon?.applied).toBe(false);
  });

  it("sin tramos (o sin la migración 0021) es el cálculo de siempre", () => {
    const t = computeCart({ items: [item({ qty: 12, priceTiers: undefined })], now: NOW });
    expect(t.lines[0].unitPrice).toBe(1000);
    expect(t.lines[0].tierApplied).toBeNull();
    expect(t.tierDiscount).toBe(0);
    expect(t.total).toBe(12000);
  });

  it("tramos inválidos del carrito (localStorage viejo o manipulado) se ignoran", () => {
    const t = computeCart({ items: [item({ qty: 6, priceTiers: [{ minQty: 1, price: 1 }] })], now: NOW });
    expect(t.lines[0].unitPrice).toBe(1000);
  });
});

describe("tramos: precio para mostrar", () => {
  const product = { id: "prod-a", categoryIds: [], priceTiers: TIERS };
  const variant = { id: "var-a", price: 1000, compareAtPrice: 1500 };

  it("con 1 unidad muestra el precio de siempre y la tabla completa", () => {
    const r = applyPromotions(variant, product, [], NOW);
    expect(r.price).toBe(1000);
    expect(r.compareAt).toBe(1500);
    expect(r.tier).toBeNull();
    expect(r.tiers).toEqual([
      { minQty: 1, maxQty: 5, basePrice: 1000, price: 1000 },
      { minQty: 6, maxQty: 11, basePrice: 900, price: 900 },
      { minQty: 12, maxQty: null, basePrice: 800, price: 800 },
    ]);
  });

  it("con la cantidad del tramo cambia el precio; el tachado es el de la variante (no compare_at)", () => {
    const r = applyPromotions(variant, product, [], NOW, 6);
    expect(r.price).toBe(900);
    expect(r.tier).toEqual({ minQty: 6, price: 900 });
    expect(r.compareAt).toBe(1000);
    expect(r.discountPercent).toBe(10);
  });

  it("la tabla lleva las promos por unidad", () => {
    const r = applyPromotions(variant, product, [promo({ value: 10 })], NOW, 12);
    expect(r.price).toBe(720);
    expect(r.tiers.map((row) => row.price)).toEqual([900, 810, 720]);
  });

  it("sin tramos útiles para la variante no hay tabla", () => {
    expect(applyPromotions({ id: "v", price: 700 }, product, [], NOW, 12).tiers).toEqual([]);
    expect(applyPromotions({ id: "v", price: 1000 }, { id: "p", categoryIds: [] }, [], NOW, 12).tiers).toEqual([]);
    // Sólo el tramo de 12 baja una variante de $ 850.
    expect(applyPromotions({ id: "v", price: 850 }, product, [], NOW).tiers.map((t) => t.minQty)).toEqual([1, 12]);
  });
});
