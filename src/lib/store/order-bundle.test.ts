import { describe, expect, it } from "vitest";

import { computeCart, type Promotion } from "@/lib/pricing";

import { averagedUnitPrice, orderLinesPayload, splitPromotions, supportsOrderBundle } from "./order-bundle";

const x3x2: Promotion = {
  id: "q-3x2",
  name: "3x2",
  type: "bxgy",
  value: 0,
  buy: 3,
  pay: 2,
  scope: "all",
  categoryIds: [],
  productIds: [],
  isActive: true,
  priority: 0,
  stackable: false,
};

const cart = (qty: number, listPrice: number) =>
  computeCart({
    items: [
      { variantId: "v-remera", productId: "p-remera", categoryIds: [], qty, listPrice },
      { variantId: "v-taza", productId: "p-taza", categoryIds: [], qty: 1, listPrice: 50 },
    ],
    promotions: [{ ...x3x2, scope: "products", productIds: ["p-remera"] }],
    now: new Date("2026-09-22T12:00:00Z"),
  });

describe("payload de create_order", () => {
  it("con 0018: precio real por línea y bundle_discount aparte (3 × $ 100 → $ 200)", () => {
    const t = cart(3, 100);
    expect(orderLinesPayload(t, true)).toEqual({
      lines: [
        { variant_id: "v-remera", unit_price: 100 },
        { variant_id: "v-taza", unit_price: 50 },
      ],
      bundle_discount: 100,
    });
    expect(t.total).toBe(250);
  });

  it("sin 0018: precio promedio por línea y sin bundle_discount (lo que ya aceptaba create_order)", () => {
    const payload = orderLinesPayload(cart(3, 100), false);
    expect(payload).toEqual({
      lines: [
        { variant_id: "v-remera", unit_price: 66.66 },
        { variant_id: "v-taza", unit_price: 50 },
      ],
    });
    expect("bundle_discount" in payload).toBe(false);
  });

  it("sin promo por cantidad: bundle_discount 0 y los mismos precios en los dos modos", () => {
    const t = cart(2, 100);
    expect(orderLinesPayload(t, true).bundle_discount).toBe(0);
    expect(orderLinesPayload(t, false).lines).toEqual(orderLinesPayload(t, true).lines);
  });

  it("precio promedio exacto cuando divide justo", () => {
    const t = cart(6, 300);
    const remera = t.lines.find((l) => l.variantId === "v-remera")!;
    expect(averagedUnitPrice(remera)).toBe(200);
  });

  it("detecta la versión del esquema", () => {
    expect(supportsOrderBundle(9)).toBe(true);
    expect(supportsOrderBundle(12)).toBe(true);
    expect(supportsOrderBundle(8)).toBe(false);
    expect(supportsOrderBundle(null)).toBe(false);
    expect(supportsOrderBundle("9")).toBe(false);
  });
});

describe("desglose de promociones del pedido", () => {
  it("separa las promos por cantidad de promo_total", () => {
    expect(splitPromotions(1200, 900)).toEqual({ unit: 300, bundle: 900 });
    expect(splitPromotions(100, "100.00")).toEqual({ unit: 0, bundle: 100 });
  });

  it("sin la migración (campo ausente) todo queda como promociones, como antes", () => {
    expect(splitPromotions(500, undefined)).toEqual({ unit: 500, bundle: 0 });
    expect(splitPromotions(500, null)).toEqual({ unit: 500, bundle: 0 });
  });

  it("nunca muestra más de lo que dice promo_total", () => {
    expect(splitPromotions(50, 80)).toEqual({ unit: 0, bundle: 50 });
    expect(splitPromotions(50, -5)).toEqual({ unit: 50, bundle: 0 });
  });
});
