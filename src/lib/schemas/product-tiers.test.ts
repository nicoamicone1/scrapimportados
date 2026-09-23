import { describe, expect, it } from "vitest";

import { emptyFormState, snapshot, toPayload } from "@/components/admin/products/form-state";

import { productSchema, tierBasePrice } from "./product";

function input(priceTiers: { min_qty: number; price: number }[], variants = [{ price: 1000 }]) {
  return {
    name: "Remera",
    variants: variants.map((v, i) => ({ title: i ? `V${i}` : "Default", price: v.price, stock: 0 })),
    price_tiers: priceTiers,
  };
}

const errorsOf = (value: unknown) => {
  const r = productSchema.safeParse(value);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("productSchema · precios por cantidad", () => {
  it("acepta tramos crecientes en cantidad y decrecientes en precio, menores al precio base", () => {
    const r = productSchema.safeParse(
      input([
        { min_qty: 6, price: 900 },
        { min_qty: 12, price: 800 },
      ]),
    );
    expect(r.success).toBe(true);
    expect(r.success && r.data.price_tiers).toHaveLength(2);
  });

  it("sin tramos es un producto como siempre", () => {
    const r = productSchema.safeParse({ name: "Remera", variants: [{ price: 1000, stock: 0 }] });
    expect(r.success && r.data.price_tiers).toEqual([]);
  });

  it("rechaza cantidades menores a 2, no enteras o que no crecen", () => {
    expect(errorsOf(input([{ min_qty: 1, price: 900 }]))["price_tiers.0.min_qty"]).toBe("Tiene que ser 2 o más.");
    expect(errorsOf(input([{ min_qty: 6.5, price: 900 }]))["price_tiers.0.min_qty"]).toBe("Tiene que ser un número entero.");
    expect(
      errorsOf(
        input([
          { min_qty: 6, price: 900 },
          { min_qty: 6, price: 800 },
        ]),
      )["price_tiers.1.min_qty"],
    ).toMatch(/más que el tramo anterior \(6\)/);
  });

  it("rechaza precios que no bajan o que no son menores al precio base", () => {
    expect(errorsOf(input([{ min_qty: 6, price: 1000 }]))["price_tiers.0.price"]).toMatch(/menor al precio base/);
    expect(
      errorsOf(
        input([
          { min_qty: 6, price: 900 },
          { min_qty: 12, price: 900 },
        ]),
      )["price_tiers.1.price"],
    ).toMatch(/menor al del tramo anterior/);
    expect(errorsOf(input([{ min_qty: 6, price: 0 }]))["price_tiers.0.price"]).toBe("Tiene que ser mayor a 0.");
  });

  it("con variantes de precios distintos, el tramo tiene que bajar la más barata", () => {
    expect(errorsOf(input([{ min_qty: 6, price: 950 }], [{ price: 1000 }, { price: 900 }]))["price_tiers.0.price"]).toMatch(/menor al precio base/);
    expect(tierBasePrice([{ price: 1000 }, { price: 900, is_active: false }])).toBe(1000);
    expect(tierBasePrice([{ price: Number.NaN }])).toBeNull();
  });

  it("acepta hasta 10 tramos (el tope de la base; el editor agrega hasta 4)", () => {
    const tiers = (n: number) => Array.from({ length: n }, (_, i) => ({ min_qty: i + 2, price: 900 - i * 10 }));
    expect(productSchema.safeParse(input(tiers(10))).success).toBe(true);
    expect(errorsOf(input(tiers(11)))["price_tiers"]).toBe("Hasta 10 tramos.");
  });

  it("redondea a centavos antes de validar: se valida lo que se guarda", () => {
    const r = productSchema.safeParse(input([{ min_qty: 6, price: 899.996 }]));
    expect(r.success && r.data.price_tiers[0].price).toBe(900);
    // 900,004 se guarda como 900: no baja del tramo anterior.
    expect(
      errorsOf(
        input([
          { min_qty: 6, price: 900 },
          { min_qty: 12, price: 900.004 },
        ]),
      )["price_tiers.1.price"],
    ).toMatch(/menor al del tramo anterior/);
    // 999,996 se guarda como 1.000: no es menor al precio base.
    expect(errorsOf(input([{ min_qty: 6, price: 999.996 }]))["price_tiers.0.price"]).toMatch(/menor al precio base/);
    expect(errorsOf(input([{ min_qty: 6, price: 0.004 }]))["price_tiers.0.price"]).toBe("Tiene que ser mayor a 0.");
  });
});

describe("form-state · precios por cantidad", () => {
  it("las filas vacías no viajan y los textos se parsean", () => {
    const state = {
      ...emptyFormState(),
      price_tiers: [
        { key: "a", min_qty: "6", price: "900,50" },
        { key: "b", min_qty: "", price: "" },
        { key: "c", min_qty: "12", price: "x" },
      ],
    };
    const payload = toPayload(state, null);
    expect(payload.price_tiers?.[0]).toEqual({ min_qty: 6, price: 900.5 });
    expect(payload.price_tiers).toHaveLength(2);
    expect(Number.isNaN(payload.price_tiers?.[1].price)).toBe(true);
  });

  it("un borrador viejo sin `price_tiers` compara igual que uno sin tramos", () => {
    const base = emptyFormState();
    const legacy = { ...base };
    delete legacy.price_tiers;
    expect(snapshot(legacy)).toBe(snapshot(base));
    expect(toPayload(legacy, null).price_tiers).toEqual([]);
  });
});
