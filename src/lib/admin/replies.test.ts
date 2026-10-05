import { describe, expect, it } from "vitest";

import { WA_MAX_MESSAGE } from "@/lib/store/whatsapp";

import {
  freeShippingReply,
  hasPaymentInfo,
  listJoin,
  paymentReply,
  pickupReply,
  productReply,
  stockLevel,
  transferReply,
  variantLabel,
  variantUrl,
  zoneReply,
  zoneTarget,
  type ReplyPayments,
  type ReplyProduct,
  type ReplyTerms,
  type ReplyVariant,
} from "./replies";

// formatMoney y formatPercent usan espacio irrompible ("$ 24.900", "10 %").
const NB = " ";
const URL = "https://taller-luna.ecommy.app/producto/remera-basica";
const EMOJI = /\p{Extended_Pictographic}/u;

const v = (id: string, title: string | null, price: number, stock: number, extra: Partial<ReplyVariant> = {}): ReplyVariant => ({
  id,
  title,
  price,
  stock,
  trackInventory: true,
  allowBackorder: false,
  ...extra,
});

const remera: ReplyProduct = {
  name: "Remera básica",
  url: URL,
  variants: [v("s", "Negro / S", 24900, 10), v("m", "Negro / M", 24900, 2), v("l", "Negro / L", 26900, 0)],
};

const terms: ReplyTerms = { transferDiscount: 10, freeInstallments: 6 };
const bare: ReplyTerms = { transferDiscount: 0, freeInstallments: 0 };

describe("helpers", () => {
  it("stockLevel: sin control, sin stock, últimas unidades y venta sin stock", () => {
    expect(stockLevel({ stock: 0, trackInventory: false, allowBackorder: false })).toBe("in");
    expect(stockLevel({ stock: 0, trackInventory: true, allowBackorder: false })).toBe("out");
    expect(stockLevel({ stock: 0, trackInventory: true, allowBackorder: true })).toBe("in");
    expect(stockLevel({ stock: 3, trackInventory: true, allowBackorder: false })).toBe("low");
    expect(stockLevel({ stock: 3, trackInventory: true, allowBackorder: true })).toBe("in");
    expect(stockLevel({ stock: 4, trackInventory: true, allowBackorder: false })).toBe("in");
  });

  it("variantLabel y listJoin", () => {
    expect(variantLabel("Default")).toBeNull();
    expect(variantLabel("")).toBeNull();
    expect(variantLabel("Negro/M")).toBe("Negro / M");
    expect(listJoin(["S"])).toBe("S");
    expect(listJoin(["S", "M"])).toBe("S y M");
    expect(listJoin(["S", "M", "L"])).toBe("S, M y L");
  });

  it("variantUrl suma ?variant= o &variant=", () => {
    expect(variantUrl(URL, "abc")).toBe(`${URL}?variant=abc`);
    expect(variantUrl(`${URL}?x=1`, "abc")).toBe(`${URL}?x=1&variant=abc`);
  });
});

describe("respuesta de producto", () => {
  it("variante con stock: precio, descuento por transferencia, cuotas y link a la variante", () => {
    const text = productReply(remera, terms, "s");
    expect(text).toBe(
      `Sí, tenemos Remera básica en Negro / S. Sale $${NB}24.900, con 10${NB}% menos pagando por transferencia o en 6 cuotas sin interés. Podés comprarlo acá: ${URL}?variant=s`,
    );
  });

  it("sin descuento ni cuotas no inventa beneficios", () => {
    const text = productReply(remera, bare, "s");
    expect(text).toBe(`Sí, tenemos Remera básica en Negro / S. Sale $${NB}24.900. Podés comprarlo acá: ${URL}?variant=s`);
    expect(productReply(remera, { transferDiscount: 0, freeInstallments: 3 }, "s")).toContain(`Sale $${NB}24.900 o en 3 cuotas sin interés.`);
    expect(productReply(remera, { transferDiscount: 15, freeInstallments: 0 }, "s")).toContain(", con 15 % menos pagando por transferencia.");
  });

  it("poco stock: avisa las últimas unidades (y la última en singular)", () => {
    expect(productReply(remera, terms, "m")).toContain("Sí, tenemos Remera básica en Negro / M. Nos quedan las últimas 2 unidades. Sale");
    const one = { ...remera, variants: [v("u", null, 1000, 1)] };
    expect(productReply(one, bare)).toBe(`Sí, tenemos Remera básica. Nos queda la última unidad. Sale $${NB}1.000. Podés comprarlo acá: ${URL}`);
  });

  it("variante sin stock: ofrece el aviso de reposición y las otras variantes", () => {
    expect(productReply(remera, terms, "l")).toBe(
      `Por ahora no nos queda Remera básica en Negro / L. Sí tenemos en Negro / S y Negro / M. Si querés, dejá tu mail en la ficha y te avisamos apenas vuelva: ${URL}?variant=l`,
    );
  });

  it("sin avisos de stock no promete el aviso", () => {
    const text = productReply(remera, { ...bare, stockAlerts: false }, "l");
    expect(text).not.toContain("avisamos");
    expect(text).toContain(`Podés ver el producto acá: ${URL}?variant=l`);
  });

  it("producto entero: variantes con stock, las que faltan y rango de precios", () => {
    const text = productReply(remera, terms);
    expect(text).toBe(
      `Sí, tenemos Remera básica en Negro / S y Negro / M. En Negro / L por ahora no nos queda. Sale $${NB}24.900, con 10${NB}% menos pagando por transferencia o en 6 cuotas sin interés. Podés comprarlo acá: ${URL}`,
    );
    const all = { ...remera, variants: remera.variants.map((x) => ({ ...x, stock: 20 })) };
    expect(productReply(all, bare)).toBe(
      `Sí, tenemos Remera básica en Negro / S, Negro / M y Negro / L. Sale entre $${NB}24.900 y $${NB}26.900. Podés comprarlo acá: ${URL}`,
    );
  });

  it("producto entero sin stock en ninguna variante", () => {
    const none = { ...remera, variants: remera.variants.map((x) => ({ ...x, stock: 0 })) };
    expect(productReply(none, terms)).toBe(
      `Por ahora no nos queda Remera básica. Si querés, dejá tu mail en la ficha y te avisamos apenas vuelva: ${URL}`,
    );
  });

  it("producto sin opciones con precio tachado", () => {
    const mate: ReplyProduct = { name: "Mate de calabaza", url: URL, variants: [v("d", "Default", 12500, 0, { trackInventory: false, compareAt: 15000 })] };
    expect(productReply(mate, bare)).toBe(`Sí, tenemos Mate de calabaza. Sale $${NB}12.500 (antes $${NB}15.000). Podés comprarlo acá: ${URL}`);
  });

  it("muchas variantes se cuentan en lugar de nombrarse", () => {
    const many: ReplyProduct = { name: "Buzo", url: URL, variants: Array.from({ length: 9 }, (_, i) => v(`v${i}`, `Talle ${i}`, 30000, 10)) };
    expect(productReply(many, bare)).toContain("Sí, tenemos Buzo, en 9 opciones.");
  });

  it("nunca pasa de WA_MAX_MESSAGE y conserva el link", () => {
    const long: ReplyProduct = {
      name: "Producto ".repeat(150).trim(),
      url: URL,
      variants: Array.from({ length: 6 }, (_, i) => v(`v${i}`, `Variante con nombre largo número ${i}`, 1000 + i, i % 2 ? 0 : 10)),
    };
    for (const id of [null, "v0", "v1"]) {
      const text = productReply(long, terms, id);
      expect(text.length).toBeLessThanOrEqual(WA_MAX_MESSAGE);
      expect(text).toContain(URL);
    }
  });

  it("sin emojis", () => {
    for (const id of [null, "s", "m", "l"]) expect(productReply(remera, terms, id)).not.toMatch(EMOJI);
  });
});

describe("envío y retiro", () => {
  it("zona con costo, plazo y envío gratis desde un monto", () => {
    expect(zoneReply({ name: "CABA", cost: 3500, freeOver: 60000, etaText: "24 a 48 hs" })).toBe(
      `A CABA el envío sale $${NB}3.500 y llega en 24 a 48 hs. Gratis en compras desde $${NB}60.000.`,
    );
  });

  it("zona gratis, sin plazo y con plazo en texto libre", () => {
    expect(zoneReply({ name: "Palermo", cost: 0, freeOver: null, etaText: null })).toBe("A Palermo el envío es gratis.");
    expect(zoneReply({ name: "GBA", cost: 5500, freeOver: null, etaText: "Mismo día" })).toBe(
      `A GBA el envío sale $${NB}5.500. Plazo de entrega: mismo día.`,
    );
    expect(zoneReply({ name: "GBA", cost: 5500, freeOver: null, etaText: "En el día" })).toContain("y llega en el día.");
  });

  it("zoneTarget contrae 'a el' y el resto del país", () => {
    expect(zoneTarget("Resto del país")).toBe("Al resto del país");
    expect(zoneTarget("El Palomar")).toBe("Al Palomar");
    expect(zoneTarget("Zona Norte")).toBe("A Zona Norte");
  });

  it("envío gratis desde un monto", () => {
    expect(freeShippingReply(90000)).toBe(
      `Envío gratis desde $${NB}90.000, a cualquier zona donde llegamos. Por debajo de ese monto, el costo depende de la zona.`,
    );
    expect(freeShippingReply(90000, {}, "https://taller-luna.ecommy.app")).toContain("Podés armar el pedido acá: https://taller-luna.ecommy.app");
  });

  it("retiro con dirección y horarios", () => {
    expect(pickupReply({ name: "Local Palermo", address: "Av. Santa Fe 3253", hoursText: "Lunes a viernes de 10 a 19 h" })).toBe(
      "Podés retirar tu pedido sin cargo en Local Palermo, Av. Santa Fe 3253. Horarios: Lunes a viernes de 10 a 19 h.",
    );
    expect(pickupReply({ name: "Local", address: null, hoursText: null })).toBe("Podés retirar tu pedido sin cargo en Local.");
  });
});

describe("pago", () => {
  const full: ReplyPayments = {
    transfer: true,
    transferDiscount: 10,
    alias: "taller.luna.mp",
    cbu: "0000003100010000000001",
    holder: "Luna SRL",
    card: true,
    freeInstallments: 6,
  };

  it("transferencia con descuento y datos, tarjeta con cuotas", () => {
    expect(paymentReply(full)).toBe(
      [
        `Podés pagar por transferencia con 10${NB}% menos. También con tarjeta de crédito o débito por Mercado Pago, en hasta 6 cuotas sin interés.`,
        "",
        "Datos para transferir:",
        "Alias: TALLER.LUNA.MP",
        "CBU/CVU: 0000003100010000000001",
        "Titular: Luna SRL",
      ].join("\n"),
    );
  });

  it("sin Mercado Pago no habla de tarjeta ni cuotas", () => {
    const text = paymentReply({ ...full, card: false, freeInstallments: 0 });
    expect(text).not.toMatch(/tarjeta|cuotas/);
    expect(text).toContain("Alias: TALLER.LUNA.MP");
  });

  it("sólo tarjeta, efectivo con descuento y sin métodos", () => {
    expect(paymentReply({ transfer: false, transferDiscount: 0, card: true, freeInstallments: 0 })).toBe(
      "Podés pagar con tarjeta de crédito o débito por Mercado Pago.",
    );
    expect(paymentReply({ transfer: true, transferDiscount: 0, card: false, freeInstallments: 0, cash: { discount: 5 } })).toBe(
      `Podés pagar por transferencia. Y en efectivo con 5${NB}% menos.`,
    );
    const none: ReplyPayments = { transfer: false, transferDiscount: 0, card: false, freeInstallments: 0 };
    expect(paymentReply(none)).toBe("");
    expect(hasPaymentInfo(none)).toBe(false);
  });

  it("datos para transferir sueltos", () => {
    expect(transferReply(full)).toBe(
      [
        `Te paso los datos. Pagando por transferencia tenés 10${NB}% menos.`,
        "",
        "Alias: TALLER.LUNA.MP",
        "CBU/CVU: 0000003100010000000001",
        "Titular: Luna SRL",
        "",
        "Cuando transfieras, mandanos el comprobante por acá.",
      ].join("\n"),
    );
    expect(transferReply({ ...full, alias: "", cbu: "", holder: "" })).toBe("");
    expect(transferReply({ ...full, transfer: false })).toBe("");
  });
});
