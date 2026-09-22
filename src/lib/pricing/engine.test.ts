import { describe, expect, it } from "vitest";

import { applyPromotions, computeCart, isPromotionEligible } from "./engine";
import type { CartItemInput, Coupon, Promotion } from "./types";

const NOW = new Date("2026-09-22T12:00:00Z");

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

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "HOLA",
    type: "percent",
    value: 10,
    minSubtotal: null,
    scope: "all",
    categoryIds: [],
    productIds: [],
    isActive: true,
    ...overrides,
  };
}

const product = { id: "prod-a", categoryIds: ["cat-cocina"] };
const variant = { id: "var-a", price: 1000 };

function item(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return { variantId: "var-a", productId: "prod-a", categoryIds: ["cat-cocina"], qty: 1, listPrice: 1000, ...overrides };
}

describe("applyPromotions", () => {
  it("sin promociones devuelve el precio de lista", () => {
    const r = applyPromotions(variant, product, [], NOW);
    expect(r.price).toBe(1000);
    expect(r.listPrice).toBe(1000);
    expect(r.compareAt).toBeNull();
    expect(r.promotion).toBeNull();
    expect(r.discountPercent).toBe(0);
  });

  it("aplica un porcentaje y marca el precio de lista para tachar", () => {
    const r = applyPromotions(variant, product, [promo({ value: 20, badgeLabel: "-20 %" })], NOW);
    expect(r.price).toBe(800);
    expect(r.compareAt).toBe(1000);
    expect(r.discountPercent).toBe(20);
    expect(r.promotion?.badgeLabel).toBe("-20 %");
  });

  it("aplica un monto fijo sin bajar de cero", () => {
    expect(applyPromotions(variant, product, [promo({ type: "fixed", value: 150 })], NOW).price).toBe(850);
    expect(applyPromotions(variant, product, [promo({ type: "fixed", value: 5000 })], NOW).price).toBe(0);
  });

  it("gana la de mayor prioridad si no son acumulables", () => {
    const r = applyPromotions(
      variant,
      product,
      [promo({ id: "a", value: 30, priority: 1 }), promo({ id: "b", value: 10, priority: 5 })],
      NOW,
    );
    expect(r.price).toBe(900);
    expect(r.promotion?.id).toBe("b");
    expect(r.promotions).toHaveLength(1);
  });

  it("acumula en cascada las promos stackable", () => {
    const r = applyPromotions(
      variant,
      product,
      [
        promo({ id: "a", value: 10, priority: 5, stackable: true }),
        promo({ id: "b", type: "fixed", value: 100, priority: 1, stackable: true }),
        promo({ id: "c", value: 50, priority: 0, stackable: false }),
      ],
      NOW,
    );
    // 1000 → -10 % = 900 → -100 = 800; la no acumulable se ignora.
    expect(r.price).toBe(800);
    expect(r.promotions.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("respeta el alcance por categoría y por producto", () => {
    const byCat = promo({ scope: "categories", categoryIds: ["cat-audio"] });
    const byProduct = promo({ scope: "products", productIds: ["prod-a"], value: 25 });
    expect(isPromotionEligible(byCat, product, NOW)).toBe(false);
    expect(applyPromotions(variant, product, [byCat, byProduct], NOW).price).toBe(750);
  });

  it("ignora promos inactivas, futuras o vencidas", () => {
    const list = [
      promo({ id: "off", isActive: false }),
      promo({ id: "future", startsAt: "2026-10-01T00:00:00Z" }),
      promo({ id: "past", endsAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(applyPromotions(variant, product, list, NOW).price).toBe(1000);
  });

  it("usa compare_at_price de la variante cuando no hay promo", () => {
    const r = applyPromotions({ id: "v", price: 800, compareAtPrice: 1000 }, product, [], NOW);
    expect(r.compareAt).toBe(1000);
    expect(r.discountPercent).toBe(20);
  });
});

describe("computeCart", () => {
  it("suma subtotal, promos y total de varias líneas", () => {
    const r = computeCart({
      items: [item({ qty: 2 }), item({ variantId: "var-b", productId: "prod-b", categoryIds: [], listPrice: 500, qty: 3 })],
      promotions: [promo({ scope: "products", productIds: ["prod-a"], value: 10 })],
      now: NOW,
    });
    expect(r.subtotal).toBe(3500);
    expect(r.promoTotal).toBe(200);
    expect(r.total).toBe(3300);
    expect(r.itemCount).toBe(5);
    expect(r.lines[0].unitPrice).toBe(900);
  });

  it("aplica el descuento del método de pago sobre la mercadería (después de promos y cupón)", () => {
    const r = computeCart({
      items: [item({ qty: 2 })],
      promotions: [promo({ value: 10 })],
      coupon: coupon({ type: "fixed", value: 200 }),
      paymentMethod: { code: "transfer", discountPercent: 10 },
      now: NOW,
    });
    // 2000 − 200 (promo) − 200 (cupón) = 1600 → −10 % = 1440
    expect(r.merchandiseTotal).toBe(1600);
    expect(r.paymentDiscount).toBe(160);
    expect(r.discountTotal).toBe(560);
    expect(r.total).toBe(1440);
  });

  it("cupón porcentual sólo sobre las líneas elegibles por categoría", () => {
    const r = computeCart({
      items: [item({ qty: 1 }), item({ variantId: "var-b", productId: "prod-b", categoryIds: ["cat-audio"], listPrice: 2000 })],
      coupon: coupon({ scope: "categories", categoryIds: ["cat-audio"], value: 50 }),
      now: NOW,
    });
    expect(r.coupon).toMatchObject({ applied: true, eligibleSubtotal: 2000, discount: 1000 });
    expect(r.total).toBe(2000);
  });

  it("rechaza el cupón si no se alcanza la compra mínima", () => {
    const r = computeCart({ items: [item()], coupon: coupon({ minSubtotal: 5000 }), now: NOW });
    expect(r.coupon?.applied).toBe(false);
    expect(r.couponDiscount).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("el cupón fijo nunca supera el subtotal elegible", () => {
    const r = computeCart({ items: [item()], coupon: coupon({ type: "fixed", value: 99999 }), now: NOW });
    expect(r.couponDiscount).toBe(1000);
    expect(r.total).toBe(0);
  });

  it("cobra envío salvo que se supere free_over", () => {
    const base = { items: [item()], now: NOW };
    expect(computeCart({ ...base, shipping: { cost: 3000, freeOver: 50000 } }).total).toBe(4000);
    const free = computeCart({ ...base, shipping: { cost: 3000, freeOver: 1000 } });
    expect(free.freeShipping).toBe(true);
    expect(free.total).toBe(1000);
  });

  it("cupón de envío gratis anula el costo de envío", () => {
    const r = computeCart({
      items: [item()],
      coupon: coupon({ type: "free_shipping", value: 0 }),
      shipping: { cost: 3000 },
      now: NOW,
    });
    expect(r.shippingCost).toBe(0);
    expect(r.freeShipping).toBe(true);
    expect(r.total).toBe(1000);
  });

  it("redondea a centavos y el envío no recibe el descuento del método de pago", () => {
    const r = computeCart({
      items: [item({ listPrice: 333.33, qty: 3 })],
      paymentMethod: { code: "transfer", discountPercent: 10 },
      shipping: { cost: 500 },
      now: NOW,
    });
    expect(r.subtotal).toBe(999.99);
    expect(r.paymentDiscount).toBe(100);
    expect(r.total).toBe(1399.99);
  });

  it("carrito vacío da todo en cero e ignora el cupón", () => {
    const r = computeCart({ items: [], coupon: coupon(), now: NOW });
    expect(r.total).toBe(0);
    expect(r.coupon).toBeNull();
    expect(r.lines).toEqual([]);
  });
});
