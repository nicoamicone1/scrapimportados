import { describe, expect, it } from "vitest";

import { stockBackEmail, type StockBackEmailData } from "./templates/stock";
import type { StoreEmailInfo } from "./templates/types";

const store: StoreEmailInfo = {
  name: "Taller Luna",
  url: "https://taller-luna.ecommy.app",
  logoUrl: null,
  primary: "#8a3b12",
  primaryText: "#ffffff",
  contactEmail: "hola@tallerluna.com",
  whatsappUrl: "https://wa.me/5491155550000?text=Hola",
};

/** `formatMoney` separa con espacio duro: se normaliza para comparar. */
const plain = (text: string) => text.replace(/\u00a0/g, " ");

const base: StockBackEmailData = {
  productName: "Campera de gabardina",
  productUrl: "https://taller-luna.ecommy.app/producto/campera-gabardina?variant=abc",
  currency: "ARS",
  locale: "es-AR",
  variants: [{ label: "Talle M · Beige", price: 89_000, compareAt: 99_000 }],
};

describe("stockBackEmail", () => {
  it("una variante: asunto con producto y variante, precio actual, anterior y link a la ficha", () => {
    const mail = stockBackEmail(base, store);
    expect(mail.subject).toBe("Volvió el stock de Campera de gabardina Talle M · Beige");
    expect(plain(mail.text)).toContain("Precio: $ 89.000");
    expect(plain(mail.text)).toContain("Antes: $ 99.000");
    expect(mail.text).toContain("Ver el producto: https://taller-luna.ecommy.app/producto/campera-gabardina?variant=abc");
    expect(mail.html).toContain('href="https://taller-luna.ecommy.app/producto/campera-gabardina?variant=abc"');
    expect(mail.text).toContain("Es un aviso único");
    expect(mail.text).toContain("Respondé este mail para hablar con la tienda");
  });

  it("producto sin opciones: el asunto no nombra variante y no hay fila 'Opción'", () => {
    const mail = stockBackEmail({ ...base, variants: [{ label: null, price: 12_500, compareAt: null }] }, store);
    expect(mail.subject).toBe("Volvió el stock de Campera de gabardina");
    expect(mail.text).not.toContain("Opción:");
    expect(mail.text).not.toContain("Antes:");
    expect(plain(mail.text)).toContain("$ 12.500");
  });

  it("varias variantes: las lista con precio y resume el resto", () => {
    const variants = Array.from({ length: 8 }, (_, i) => ({ label: `Talle ${36 + i}`, price: 50_000 + i * 1000, compareAt: null }));
    const mail = stockBackEmail({ ...base, variants }, store);
    expect(mail.subject).toBe("Volvió el stock de Campera de gabardina");
    expect(plain(mail.text)).toContain("- Talle 36: $ 50.000");
    expect(plain(mail.text)).toContain("- Talle 41: $ 55.000");
    expect(mail.text).not.toContain("Talle 42:");
    expect(mail.text).toContain("Y 2 opciones más en la tienda.");
    expect(plain(mail.html)).toContain("Volvieron 8 opciones desde $ 50.000 en Taller Luna.");
  });

  it("escapa el nombre del producto en el HTML y no inventa urgencia", () => {
    const mail = stockBackEmail({ ...base, productName: 'Mate <b>"Imperial"</b>' }, store);
    expect(mail.html).not.toContain("<b>\"Imperial\"</b>");
    expect(mail.html).toContain("&lt;b&gt;");
    expect(mail.text).not.toMatch(/!/);
  });
});
