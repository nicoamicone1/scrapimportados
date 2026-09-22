import { describe, expect, it } from "vitest";

import { netMerchandiseTotal } from "./cart-pricing";
import { describeIssue, validateCart, type FreshVariant } from "./cart-validation";
import { markdownToHtml, markdownToText } from "./markdown";
import { matchesTokens, normalizeSearch, searchScore, searchText, searchTokens } from "./search";
import { buildOrderMessage, buildProductMessage, fillTemplate, waLink, WA_MAX_MESSAGE } from "./whatsapp";

describe("búsqueda", () => {
  it("normaliza acentos, mayúsculas y puntuación", () => {
    expect(normalizeSearch("Lámpara  LED — 12V")).toBe("lampara led 12v");
    expect(searchTokens("  Taladro percutor taladro ")).toEqual(["taladro", "percutor"]);
  });

  it("matchea por tokens en cualquier orden sobre nombre, SKU, marca y tags", () => {
    const item = { name: "Taladro percutor 13 mm 750 W", sku: "TP-750", brand: "Bosch", tags: ["herramientas"] };
    const text = searchText(item);
    expect(matchesTokens(text, searchTokens("percutor taladro"))).toBe(true);
    expect(matchesTokens(text, searchTokens("bosch 750"))).toBe(true);
    expect(matchesTokens(text, searchTokens("tp 750"))).toBe(true);
    expect(matchesTokens(text, searchTokens("herramientas"))).toBe(true);
    expect(matchesTokens(text, searchTokens("taladro inalambrico"))).toBe(false);
  });

  it("sin acentos en la consulta encuentra con acentos en el nombre", () => {
    expect(matchesTokens(searchText({ name: "Mesa de lapacho Misiones" }), searchTokens("mesa lápacho"))).toBe(true);
  });

  it("ordena por relevancia: nombre > marca, SKU exacto suma", () => {
    const tokens = searchTokens("mate");
    const inName = searchScore({ name: "Mate de calabaza" }, tokens);
    const inBrand = searchScore({ name: "Bombilla alpaca", brand: "Mateando" }, tokens);
    expect(inName).toBeGreaterThan(inBrand);
    expect(searchScore({ name: "Otra cosa" }, tokens)).toBe(0);
    expect(searchScore({ name: "Taladro", sku: "ABC123" }, searchTokens("abc123"))).toBeGreaterThan(10);
  });
});

describe("markdown", () => {
  it("convierte títulos, párrafos, listas, negrita y links", () => {
    const html = markdownToHtml("# Envíos\n\nHacemos envíos a **todo el país**.\n\n- CABA\n- GBA\n\n1. Uno\n2. Dos\n\n[Ver más](/productos)");
    expect(html).toContain("<h2>Envíos</h2>");
    expect(html).toContain("<strong>todo el país</strong>");
    expect(html).toContain("<ul><li>CABA</li><li>GBA</li></ul>");
    expect(html).toContain("<ol><li>Uno</li><li>Dos</li></ol>");
    expect(html).toContain('<a href="/productos">Ver más</a>');
  });

  it("escapa HTML y descarta URLs peligrosas", () => {
    const html = markdownToHtml("<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("links externos abren en otra pestaña con rel seguro", () => {
    expect(markdownToHtml("[Defensa](https://www.argentina.gob.ar)")).toContain('rel="noopener noreferrer"');
  });

  it("texto plano para metadescripciones", () => {
    expect(markdownToText("## Hola\n\n**Mundo** [link](/x)", 50)).toBe("Hola Mundo link");
  });
});

describe("WhatsApp", () => {
  it("arma el link con el teléfono en dígitos", () => {
    expect(waLink("+54 9 381 617-3548", "Hola")).toBe("https://wa.me/5493816173548?text=Hola");
    expect(waLink("", "a b")).toBe("https://wa.me/?text=a%20b");
  });

  it("completa la plantilla y agrega el link si no está", () => {
    expect(fillTemplate("#{number} {x}", { number: 1043 })).toBe("#1043 ");
    const msg = buildOrderMessage({
      template: "Hola! Pedido #{number} en {store}.\n\n{items}\n\nTotal: {total}\n{delivery}\n\nNombre: {name}",
      number: 1043,
      storeName: "Ecommy",
      customerName: "Ana",
      items: [
        { name: "Mate", variantTitle: "Rojo", qty: 2, total: 20000 },
        { name: "Bombilla", qty: 1, total: 5500.5 },
      ],
      total: 25500.5,
      delivery: "Envío a Av. Santa Fe 3253, CABA",
      url: "https://tienda.com/pedido/abc",
    });
    expect(msg).toContain("Pedido #1043 en Ecommy");
    expect(msg).toContain("- 2 x Mate (Rojo): $ 20.000");
    expect(msg).toContain("Total: $ 25.500,50");
    expect(msg).toContain("Nombre: Ana");
    expect(msg.endsWith("Ver pedido: https://tienda.com/pedido/abc")).toBe(true);
  });

  it("resume pedidos largos para no pasar el límite de wa.me", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ name: `Producto con nombre largo número ${i}`, qty: 1, total: 1000 }));
    const msg = buildOrderMessage({
      number: 1,
      storeName: "T",
      customerName: "A",
      items,
      total: 60000,
      delivery: "Retiro",
      url: "https://t.com/pedido/x",
    });
    expect(msg.length).toBeLessThanOrEqual(WA_MAX_MESSAGE);
    expect(msg).toContain("más (ver el pedido)");
    expect(msg).toContain("https://t.com/pedido/x");
  });

  it("mensaje de consulta desde la ficha", () => {
    expect(buildProductMessage("Hola! Tengo una consulta.", { name: "Mate", url: "https://t.com/producto/mate" })).toBe(
      "Hola, consulto por *Mate* https://t.com/producto/mate",
    );
    expect(buildProductMessage("Consulta: {product} ({url})", { name: "Mate", url: "u" })).toBe("Consulta: Mate (u)");
  });
});

describe("validación del carrito", () => {
  const fresh = (over: Partial<FreshVariant> = {}): FreshVariant => ({
    variantId: "v1",
    productId: "p1",
    slug: "mate",
    name: "Mate",
    variantTitle: null,
    sku: "M1",
    image: null,
    price: 1000,
    compareAtPrice: null,
    categoryIds: [],
    vatPercent: null,
    stock: 5,
    trackInventory: true,
    allowBackorder: false,
    active: true,
    ...over,
  });
  const line = { variantId: "v1", name: "Mate", unitPrice: 1000, qty: 2 };

  it("sin cambios no hay avisos", () => {
    const r = validateCart([line], new Map([["v1", fresh()]]));
    expect(r.issues).toEqual([]);
    expect(r.patches[0]).toMatchObject({ qty: 2, unitPrice: 1000, maxQty: 5 });
  });

  it("quita lo que ya no existe o quedó sin stock", () => {
    expect(validateCart([line], new Map()).issues[0].type).toBe("removed");
    const r = validateCart([line], new Map([["v1", fresh({ stock: 0 })]]));
    expect(r.issues[0].type).toBe("out_of_stock");
    expect(r.patches[0].qty).toBe(0);
  });

  it("acota la cantidad al stock y avisa cambios de precio", () => {
    const r = validateCart([{ ...line, qty: 9 }], new Map([["v1", fresh({ stock: 3, price: 1200 })]]));
    expect(r.patches[0]).toMatchObject({ qty: 3, unitPrice: 1200 });
    expect(r.issues.map((i) => i.type)).toEqual(["qty_reduced", "price_changed"]);
    expect(describeIssue(r.issues[0])).toContain("quedan 3");
  });

  it("backorder o sin control de stock: sin tope", () => {
    const r = validateCart([{ ...line, qty: 50 }], new Map([["v1", fresh({ stock: 0, allowBackorder: true })]]));
    expect(r.patches[0]).toMatchObject({ qty: 50, maxQty: null });
    expect(r.issues).toEqual([]);
  });
});

describe("precio sin impuestos nacionales del carrito", () => {
  it("usa la alícuota de cada producto y la default para el resto", () => {
    const lines = [
      { variantId: "a", lineTotal: 12100 },
      { variantId: "b", lineTotal: 11050 },
    ];
    const items = [{ variantId: "a" }, { variantId: "b", vatPercent: 10.5 }];
    expect(netMerchandiseTotal(lines, items, 21, 23150)).toBe(20000);
  });
  it("reparte el cupón en proporción", () => {
    expect(netMerchandiseTotal([{ variantId: "a", lineTotal: 12100 }], [{ variantId: "a" }], 21, 6050)).toBe(5000);
  });
});
