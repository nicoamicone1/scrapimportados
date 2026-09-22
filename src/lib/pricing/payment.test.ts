import { describe, expect, it } from "vitest";

import { computeCart } from "./engine";
import { bestPaymentDiscount, netPrice, priceWithDiscount, resolveVatPercent } from "./payment";

describe("netPrice", () => {
  it("saca el IVA del precio final", () => {
    expect(netPrice(12100, 21)).toBe(10000);
    expect(netPrice(11050, 10.5)).toBe(10000);
    expect(netPrice(12700, 27)).toBe(10000);
  });

  it("redondea a 2 decimales", () => {
    // 999.99 / 1.21 = 826.4380…
    expect(netPrice(999.99, 21)).toBe(826.44);
    // 100 / 1.105 = 90.4977…
    expect(netPrice(100, 10.5)).toBe(90.5);
  });

  it("alícuota 0, negativa, nula o inválida devuelve el final", () => {
    expect(netPrice(1234.5, 0)).toBe(1234.5);
    expect(netPrice(1234.5, -5)).toBe(1234.5);
    expect(netPrice(1234.5, null)).toBe(1234.5);
    expect(netPrice(1234.5, undefined)).toBe(1234.5);
    expect(netPrice(1234.5, Number.NaN)).toBe(1234.5);
  });

  it("precio 0 o inválido da 0", () => {
    expect(netPrice(0, 21)).toBe(0);
    expect(netPrice(Number.NaN, 21)).toBe(0);
  });
});

describe("resolveVatPercent", () => {
  it("usa la del producto si está, si no la default", () => {
    expect(resolveVatPercent(10.5, 21)).toBe(10.5);
    expect(resolveVatPercent(0, 21)).toBe(0);
    expect(resolveVatPercent(null, 21)).toBe(21);
    expect(resolveVatPercent(undefined, 27)).toBe(27);
    expect(resolveVatPercent("10.5", 21)).toBe(10.5);
  });

  it("sin default válido cae en 21", () => {
    expect(resolveVatPercent(null, null)).toBe(21);
  });
});

describe("bestPaymentDiscount", () => {
  const methods = [
    { code: "transfer", name: "Transferencia bancaria", discountPercent: 10 },
    { code: "whatsapp", name: "Acordar con el vendedor", discountPercent: 0 },
  ];

  it("elige el de mayor descuento", () => {
    expect(bestPaymentDiscount(methods)).toEqual({ code: "transfer", name: "Transferencia bancaria", discountPercent: 10 });
    expect(bestPaymentDiscount([...methods, { code: "cash", name: "Efectivo", discountPercent: 15 }])?.code).toBe("cash");
  });

  it("ignora inactivos y los que no descuentan", () => {
    expect(bestPaymentDiscount([{ code: "cash", discountPercent: 20, isActive: false }, ...methods])?.code).toBe("transfer");
    expect(bestPaymentDiscount([{ code: "whatsapp", discountPercent: 0 }])).toBeNull();
    expect(bestPaymentDiscount([])).toBeNull();
  });

  it("empate: gana el primero; acepta strings; tope 100 %", () => {
    expect(
      bestPaymentDiscount([
        { code: "a", discountPercent: "10" },
        { code: "b", discountPercent: 10 },
      ]),
    ).toEqual({ code: "a", name: "a", discountPercent: 10 });
    expect(bestPaymentDiscount([{ code: "x", discountPercent: 150 }])?.discountPercent).toBe(100);
    expect(bestPaymentDiscount([{ code: "x", discountPercent: "abc" }])).toBeNull();
  });
});

describe("priceWithDiscount", () => {
  it("aplica el % y redondea", () => {
    expect(priceWithDiscount(10000, 10)).toBe(9000);
    expect(priceWithDiscount(333.33, 10)).toBe(300);
    expect(priceWithDiscount(1000, 0)).toBe(1000);
    expect(priceWithDiscount(1000, 150)).toBe(0);
    expect(priceWithDiscount(1000, -10)).toBe(1000);
  });

  it("coincide con computeCart para una sola unidad", () => {
    const cart = computeCart({
      items: [{ variantId: "v", productId: "p", categoryIds: [], qty: 1, listPrice: 12345.67 }],
      paymentMethod: { code: "transfer", discountPercent: 10 },
    });
    expect(priceWithDiscount(12345.67, 10)).toBe(cart.total);
  });
});
