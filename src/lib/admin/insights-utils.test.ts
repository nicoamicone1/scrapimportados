import { describe, expect, it } from "vitest";

import {
  EMPTY_REASON,
  explainWeek,
  MAX_DRIVERS,
  priceBatchText,
  scopePhrase,
  unavailableInsights,
  type PriceBatchRow,
  type TopProductRow,
  type WeekInput,
} from "./insights-utils";

const TZ = "America/Argentina/Buenos_Aires";

/** `formatMoney` usa espacio irrompible después de "$". */
const plain = (s: string | undefined) => s?.replace(/\u00a0/g, " ");

function p(productId: string | null, name: string, qty: number, revenue = qty * 1000): TopProductRow {
  return { productId, name, qty, revenue };
}

function batch(over: Partial<PriceBatchRow> = {}): PriceBatchRow {
  return {
    // Martes 30/9/2025 a las 15:00 en Buenos Aires.
    created_at: "2025-09-30T18:00:00.000Z",
    rule_summary: "Aumentar 12 % · redondeo a la centena hacia arriba",
    scope_summary: "Categoría: Remeras",
    variant_count: 24,
    undone_at: null,
    ...over,
  };
}

function input(over: Partial<WeekInput> = {}): WeekInput {
  return {
    current: { sales: 384200, orders: 14 },
    previous: { sales: 468500, orders: 19 },
    topCurrent: [],
    topPrevious: [],
    topLimit: 50,
    priceBatches: [],
    outOfStock: [],
    productsWithStock: [],
    currency: "ARS",
    timeZone: TZ,
    ...over,
  };
}

describe("explainWeek: titular", () => {
  it("bajada: porcentaje redondeado y detalle con montos y pedidos", () => {
    const r = explainWeek(input());
    expect(r.tone).toBe("down");
    expect(r.headline).toBe("Vendiste 18 % menos que la semana pasada.");
    expect(plain(r.detail)).toBe("$ 384.200 contra $ 468.500, en 14 pedidos contra 19.");
    expect(r.emptyReason).toBeUndefined();
  });

  it("subida", () => {
    const r = explainWeek(input({ current: { sales: 150000, orders: 12 }, previous: { sales: 100000, orders: 10 } }));
    expect(r.tone).toBe("up");
    expect(r.headline).toBe("Vendiste 50 % más que la semana pasada.");
  });

  it("sin cambio: igual y casi igual", () => {
    const same = explainWeek(input({ current: { sales: 100000, orders: 10 }, previous: { sales: 100000, orders: 9 } }));
    expect(same.tone).toBe("flat");
    expect(same.headline).toBe("Vendiste lo mismo que la semana pasada.");

    const almost = explainWeek(input({ current: { sales: 98000, orders: 10 }, previous: { sales: 100000, orders: 10 } }));
    expect(almost.tone).toBe("flat");
    expect(almost.headline).toBe("Vendiste casi lo mismo que la semana pasada (−2 %).");
  });

  it("sin base: menos de 3 pedidos en ambas semanas", () => {
    const r = explainWeek(input({ current: { sales: 20000, orders: 2 }, previous: { sales: 9000, orders: 1 }, priceBatches: [batch()] }));
    expect(r.tone).toBe("empty");
    expect(r.emptyReason).toBe(EMPTY_REASON);
    expect(r.drivers).toEqual([]);
    expect(plain(r.headline)).toBe("Esta semana vendiste $ 20.000 en 2 pedidos.");

    const none = explainWeek(input({ current: { sales: 0, orders: 0 }, previous: { sales: 0, orders: 0 } }));
    expect(none.tone).toBe("empty");
    expect(none.headline).toBe("Esta semana todavía no hubo ventas.");
  });

  it("semana anterior en cero: no divide por cero", () => {
    const r = explainWeek(input({ current: { sales: 120000, orders: 5 }, previous: { sales: 0, orders: 0 } }));
    expect(r.tone).toBe("up");
    expect(plain(r.headline)).toBe("No hubo ventas la semana pasada. Esta vendiste $ 120.000.");
    expect(r.detail).toBe("En 5 pedidos.");
    expect(r.headline).not.toMatch(/Infinity|NaN/);
  });

  it("semana actual en cero", () => {
    const r = explainWeek(input({ current: { sales: 0, orders: 0 }, previous: { sales: 50000, orders: 4 } }));
    expect(r.tone).toBe("down");
    expect(r.headline).toBe("Esta semana no hubo ventas.");
    expect(plain(r.detail)).toBe("La semana pasada vendiste $ 50.000 en 4 pedidos.");
  });
});

describe("explainWeek: drivers de producto", () => {
  it("ordena por diferencia de unidades y pone primero la bajada en una semana que bajó", () => {
    const r = explainWeek(
      input({
        topPrevious: [p("a", "Remera básica negra", 26), p("b", "Set de tazas", 15), p("c", "Gorra", 5)],
        topCurrent: [p("a", "Remera básica negra", 18), p("b", "Set de tazas", 25), p("c", "Gorra", 4)],
      }),
    );
    expect(r.drivers.map((d) => d.kind)).toEqual(["product_down", "product_up"]);
    expect(r.drivers[0]).toEqual({ kind: "product_down", text: "Remera básica negra: 8 unidades menos (−31 %).", href: "/admin/productos/a" });
    // Set de tazas subió 10 (más que la remera), pero la semana bajó: la bajada va primero.
    expect(r.drivers[1].text).toBe("Set de tazas: 10 unidades más (+67 %).");
    // Gorra cambió 1 unidad: ruido, no entra.
    expect(r.drivers.some((d) => d.text.includes("Gorra"))).toBe(false);
  });

  it("producto nuevo y producto que dejó de venderse", () => {
    const r = explainWeek(
      input({
        current: { sales: 100000, orders: 10 },
        previous: { sales: 100000, orders: 10 },
        topPrevious: [p("x", "Mate de calabaza", 4)],
        topCurrent: [p("y", "Bombilla", 6)],
        productsWithStock: ["x"],
      }),
    );
    expect(r.drivers).toEqual([
      { kind: "product_up", text: "Bombilla: 6 unidades; la semana pasada no se vendió.", href: "/admin/productos/y" },
      { kind: "no_sales_product", text: "Mate de calabaza no se vendió esta semana; la pasada, 4 unidades.", href: "/admin/productos/x" },
    ]);
  });

  it("con un top lleno no inventa ceros para lo que no aparece", () => {
    const r = explainWeek(
      input({
        topLimit: 2,
        topPrevious: [p("a", "A", 10), p("b", "B", 8)],
        topCurrent: [p("a", "A", 3), p("c", "C", 9)],
      }),
    );
    const texts = r.drivers.map((d) => d.text);
    expect(texts).toContain("A: 7 unidades menos (−70 %).");
    expect(texts.some((t) => t.startsWith("B"))).toBe(false);
    expect(texts.some((t) => t.startsWith("C"))).toBe(false);
  });

  it("ítems sin producto (venta manual) no llevan link", () => {
    const r = explainWeek(input({ topPrevious: [p(null, "Arreglo a medida", 6)], topCurrent: [p(null, "Arreglo a medida", 1)] }));
    expect(r.drivers[0]).toMatchObject({ kind: "product_down", href: null });
  });
});

describe("explainWeek: precios", () => {
  it("un lote de precios aparece con día y alcance, después del producto principal", () => {
    const r = explainWeek(
      input({
        topPrevious: [p("a", "Remera básica negra", 26)],
        topCurrent: [p("a", "Remera básica negra", 18)],
        priceBatches: [batch()],
      }),
    );
    expect(r.drivers[1]).toEqual({
      kind: "price_change",
      text: 'Subiste 12 % los precios de "Remeras" el martes 30.',
      href: "/admin/precios/historial",
    });
  });

  it("un lote deshecho no cuenta", () => {
    const r = explainWeek(input({ priceBatches: [batch({ undone_at: "2025-10-01T10:00:00.000Z" })] }));
    expect(r.drivers.filter((d) => d.kind === "price_change")).toEqual([]);
  });

  it("textos de regla y alcance", () => {
    expect(priceBatchText(batch({ rule_summary: "Bajar 10 %", scope_summary: "Todo el catálogo" }), TZ)).toBe(
      "Bajaste 10 % los precios de todo el catálogo el martes 30.",
    );
    expect(priceBatchText(batch({ rule_summary: "Precio = costo + 40 % de margen", scope_summary: "Marca: Acme" }), TZ)).toBe(
      'Cambiaste los precios de la marca "Acme" el martes 30 (precio = costo + 40 % de margen).',
    );
    expect(scopePhrase("Categorías: Remeras, Buzos, Gorras (con subcategorías)", 3)).toBe('de "Remeras", "Buzos" y "Gorras"');
    expect(scopePhrase("3 productos elegidos · sólo con stock", 3)).toBe("de 3 productos");
    expect(scopePhrase("", 12)).toBe("de 12 variantes");
  });
});

describe("explainWeek: stock", () => {
  it("se quedó sin stock: vendió la semana pasada y no le queda ninguna variante", () => {
    const r = explainWeek(
      input({
        topPrevious: [p("j", "Jarra esmaltada", 7), p("t", "Taza", 3)],
        topCurrent: [p("j", "Jarra esmaltada", 2), p("t", "Taza", 3)],
        outOfStock: [
          { product_id: "j", product_name: "Jarra esmaltada", variant_title: "Blanca" },
          { product_id: "j", product_name: "Jarra esmaltada", variant_title: "Azul" },
        ],
      }),
    );
    expect(r.drivers[0]).toEqual({
      kind: "stock_out",
      text: "Jarra esmaltada se quedó sin stock y estaba entre lo más vendido.",
      href: "/admin/inventario?estado=agotado",
    });
    // Reemplaza a la bajada del mismo producto.
    expect(r.drivers.filter((d) => d.text.startsWith("Jarra"))).toHaveLength(1);
  });

  it("si le queda alguna variante con stock, no es 'sin stock'", () => {
    const r = explainWeek(
      input({
        topPrevious: [p("j", "Jarra esmaltada", 7)],
        topCurrent: [p("j", "Jarra esmaltada", 2)],
        outOfStock: [{ product_id: "j", product_name: "Jarra esmaltada", variant_title: "Azul" }],
        productsWithStock: ["j"],
      }),
    );
    expect(r.drivers[0].kind).toBe("product_down");
  });

  it("si no vendió la semana pasada, quedarse sin stock no es un driver", () => {
    const r = explainWeek(
      input({
        topCurrent: [p("k", "Kit", 3)],
        outOfStock: [{ product_id: "z", product_name: "Zapatilla", variant_title: "42" }],
      }),
    );
    expect(r.drivers.some((d) => d.kind === "stock_out")).toBe(false);
  });

  it("una sola variante con nombre: lo dice; fuera del top 5 dice cuánto vendía", () => {
    const prev = [p("a", "A", 20), p("b", "B", 18), p("c", "C", 16), p("d", "D", 14), p("e", "E", 12), p("m", "Remera negra", 4)];
    const r = explainWeek(
      input({
        topPrevious: prev,
        topCurrent: prev.filter((x) => x.productId !== "m"),
        outOfStock: [{ product_id: "m", product_name: "Remera negra", variant_title: "M" }],
      }),
    );
    expect(r.drivers.find((d) => d.kind === "stock_out")?.text).toBe("Remera negra (M) se quedó sin stock y la semana pasada vendió 4 unidades.");
  });
});

describe("explainWeek: límites", () => {
  it("nunca devuelve más de 4 drivers", () => {
    const prev = Array.from({ length: 12 }, (_, i) => p(`p${i}`, `Producto ${i}`, 20 + i));
    const cur = prev.map((x, i) => ({ ...x, qty: i % 2 ? x.qty + 5 + i : Math.max(1, x.qty - 6 - i) }));
    const r = explainWeek(
      input({
        topPrevious: prev,
        topCurrent: cur,
        priceBatches: [batch(), batch({ created_at: "2025-10-01T18:00:00.000Z" }), batch({ created_at: "2025-10-02T18:00:00.000Z" })],
        outOfStock: [{ product_id: "p0", product_name: "Producto 0", variant_title: "Default" }],
      }),
    );
    expect(r.drivers.length).toBe(MAX_DRIVERS);
    // Como mucho 2 cambios de precio, el más reciente primero.
    const prices = r.drivers.filter((d) => d.kind === "price_change");
    expect(prices.length).toBeLessThanOrEqual(2);
    expect(prices[0].text).toContain("el jueves 2");
  });

  it("unavailableInsights degrada a empty con un motivo", () => {
    const r = unavailableInsights();
    expect(r.tone).toBe("empty");
    expect(r.drivers).toEqual([]);
    expect(r.emptyReason).toBeTruthy();
  });
});
