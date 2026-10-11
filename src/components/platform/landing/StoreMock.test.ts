import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SAMPLE_ORDER } from "./sample-order";
import { LUNA, LUNA_PRODUCTS } from "./StoreMock";

/*
 * La maqueta de la tienda del hero (`StoreMock`) tiene que contar lo mismo
 * que la tienda demo de ropa de verdad (data/demo-ropa.json, la que siembra
 * `scripts/seed-demo-ropa.mts`) y que el pedido de ejemplo #1042.
 */

interface DemoVariant {
  options: Record<string, string>;
  stock: number;
}
interface DemoProduct {
  name: string;
  price: number;
  compareAt?: number;
  options: { name: string; values: string[] }[];
  variants: DemoVariant[];
}
interface DemoCatalog {
  store: { name: string; transfer: { discountPercent: number } };
  swatches: Record<string, string>;
  products: DemoProduct[];
}

const demo = JSON.parse(readFileSync(join(process.cwd(), "data", "demo-ropa.json"), "utf8")) as DemoCatalog;
const fromOrder = new Set(SAMPLE_ORDER.items.map((i) => i.name));

describe("StoreMock: la tienda de ropa de ejemplo", () => {
  it("es Luna Indumentaria, con el descuento por transferencia de la demo y del pedido #1042", () => {
    expect(LUNA.name).toBe(demo.store.name);
    expect(SAMPLE_ORDER.store).toBe(demo.store.name);
    expect(LUNA.transferPercent).toBe(demo.store.transfer.discountPercent);
  });

  it("muestra los dos productos del pedido #1042 con su precio", () => {
    for (const item of SAMPLE_ORDER.items) {
      expect(LUNA_PRODUCTS.find((p) => p.name === item.name)?.price).toBe(item.total);
    }
  });

  it("el resto sale del catálogo de la demo: mismo precio, tachado y un color del producto", () => {
    const rest = LUNA_PRODUCTS.filter((p) => !fromOrder.has(p.name));
    expect(rest.length).toBeGreaterThanOrEqual(3);
    for (const p of rest) {
      const real = demo.products.find((d) => d.name === p.name);
      expect(real, p.name).toBeDefined();
      expect(p.price).toBe(real!.price);
      expect(p.compareAt).toBe(real!.compareAt);
      const colors = real!.options.find((o) => o.name === "Color")?.values.map((c) => demo.swatches[c].toLowerCase()) ?? [];
      expect(colors, p.name).toContain(p.color.toLowerCase());
    }
  });

  it("«Quedan 2» y «Agotado» coinciden con el stock de la demo", () => {
    const low = LUNA_PRODUCTS.filter((p) => p.low);
    expect(low.map((p) => p.name)).toEqual(["Remera básica de algodón"]);
    const [color, talle] = low[0].low!.variant.split(" · ");
    const variant = demo.products.find((d) => d.name === low[0].name)!.variants.find((v) => v.options.Color === color && v.options.Talle === talle);
    expect(variant?.stock).toBe(low[0].low!.stock);

    const soldOut = LUNA_PRODUCTS.filter((p) => p.soldOut);
    expect(soldOut.map((p) => p.name)).toEqual(["Tapado de paño largo"]);
    expect(demo.products.find((d) => d.name === soldOut[0].name)!.variants.every((v) => v.stock === 0)).toBe(true);
  });
});
