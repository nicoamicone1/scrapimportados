import { describe, expect, it } from "vitest";

import {
  bioMessage,
  categoryMessage,
  displayUrl,
  INSTAGRAM_BIO_MAX,
  productMessage,
  replyMessage,
  shareMessages,
  storyMessage,
  whatsappShareUrl,
  type ShareFacts,
} from "./messages";

const base: ShareFacts = {
  storeName: "Taller Luna",
  url: "https://taller-luna.ecommy.app",
  transferDiscount: 10,
  freeShippingFrom: 60000,
};
const bare: ShareFacts = { ...base, transferDiscount: 0, freeShippingFrom: null };

// formatMoney y formatPercent usan espacio irrompible ("$ 60.000", "10 %").
describe("mensajes para compartir", () => {
  it("displayUrl saca protocolo y barra final", () => {
    expect(displayUrl("https://taller-luna.ecommy.app/")).toBe("taller-luna.ecommy.app");
    expect(displayUrl("http://localhost:3000/s/luna")).toBe("localhost:3000/s/luna");
  });

  it("respuesta de WhatsApp con descuento y envío gratis reales", () => {
    const text = replyMessage(base);
    expect(text).toContain("te paso el catálogo completo con precios y stock: https://taller-luna.ecommy.app");
    expect(text).toContain("Con transferencia tenés 10\u00a0% off.");
    expect(text).toContain("Envío gratis desde $\u00a060.000.");
  });

  it("sin descuento ni envío gratis no inventa beneficios", () => {
    for (const text of [replyMessage(bare), bioMessage(bare), storyMessage(bare)]) {
      expect(text).not.toMatch(/off|gratis/);
    }
    expect(replyMessage(bare)).toContain("https://taller-luna.ecommy.app");
  });

  it("la bio entra en el límite de Instagram aun con un dominio largo", () => {
    expect(bioMessage(base).length).toBeLessThanOrEqual(INSTAGRAM_BIO_MAX);
    const long = { ...base, url: `https://${"a".repeat(90)}.ecommy.app` };
    const bio = bioMessage(long);
    expect(bio.length).toBeLessThanOrEqual(INSTAGRAM_BIO_MAX);
    expect(bio).toContain("ecommy.app");
  });

  it("la historia nombra la tienda y el link sin protocolo", () => {
    const text = storyMessage(base);
    expect(text.startsWith("Taller Luna ya tiene tienda online.")).toBe(true);
    expect(text).toContain("Entrá a taller-luna.ecommy.app");
  });

  it("devuelve los tres mensajes en orden", () => {
    expect(shareMessages(base).map((m) => m.id)).toEqual(["bio", "reply", "story"]);
  });

  it("whatsappShareUrl codifica el texto", () => {
    expect(whatsappShareUrl("Hola & chau\n10 %")).toBe("https://wa.me/?text=Hola%20%26%20chau%0A10%20%25");
  });

  it("mensaje de producto: precio, 'desde' si hay rango, sin precio si falta", () => {
    const url = "https://taller-luna.ecommy.app/producto/mate";
    expect(productMessage({ name: "Mate", price: 12500, url })).toBe(`Mirá Mate: $\u00a012.500 · ${url}`);
    expect(productMessage({ name: "Mate", price: 12500, maxPrice: 15000, url })).toBe(`Mirá Mate: desde $\u00a012.500 · ${url}`);
    expect(productMessage({ name: "Mate", price: null, url })).toBe(`Mirá Mate · ${url}`);
  });

  it("mensaje de categoría", () => {
    expect(categoryMessage({ name: "Mates", storeName: "Taller Luna", url: "https://x.app/categoria/mates" })).toBe(
      "Mirá Mates en Taller Luna: https://x.app/categoria/mates",
    );
  });
});
