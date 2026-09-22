import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mapShopifyProduct, type ShopifyProduct } from "./adapters/shopify";
import { mapWooCategory, mapWooProduct, type WooProduct } from "./adapters/woocommerce";
import {
  csvTemplate,
  diffUpdateRows,
  parseCategoryPaths,
  parseCreateRows,
  parseCsvText,
  parseUpdateRows,
  type ExistingVariant,
} from "./csv";
import { extractListingLinks, extractProductFromHtml, fullSizeImage, parseSitemap } from "./jsonld";
import { applyMarkup, extractPriceHtmlAmounts, fromMinorUnit, htmlToText, isJunkCategory, parseArsAmount, roundPrice } from "./text";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

describe("parseArsAmount (portado de scrape.mjs)", () => {
  it("interpreta miles con punto y decimales con coma", () => {
    expect(parseArsAmount("31.993")).toBe(31993);
    expect(parseArsAmount("1.234.567")).toBe(1234567);
    expect(parseArsAmount("1.234,50")).toBe(1234.5);
    expect(parseArsAmount("29900")).toBe(29900);
    expect(parseArsAmount("$ 12.990")).toBe(12990);
    expect(parseArsAmount("12,5")).toBe(12.5);
  });
  it("tolera formato US y basura", () => {
    expect(parseArsAmount("1,234.56")).toBe(1234.56);
    expect(parseArsAmount("1,234,567")).toBe(1234567);
    expect(parseArsAmount("12.50")).toBe(12.5);
    expect(parseArsAmount("sin precio")).toBeNull();
    expect(parseArsAmount(null)).toBeNull();
    expect(parseArsAmount("-1.500")).toBe(-1500);
  });
  it("convierte unidades menores de la Store API", () => {
    expect(fromMinorUnit("1000000", 2)).toBe(10000);
    expect(fromMinorUnit("9000", 0)).toBe(9000);
    expect(fromMinorUnit("", 2)).toBeNull();
  });
  it("extrae los montos del price_html ignorando el tachado", () => {
    const html =
      '<del><span class="woocommerce-Price-amount amount">$15.000</span></del> <span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">&#036;</span>9.630</span> <span class="woocommerce-Price-amount amount">9.000</span>';
    expect(extractPriceHtmlAmounts(html)).toEqual([9630, 9000]);
    expect(extractPriceHtmlAmounts("Precio: $ 1.234,50")).toEqual([1234.5]);
  });
  it("htmlToText decodifica entidades", () => {
    expect(htmlToText("<p>Hola &amp; chau&nbsp;<br>linea</p>")).toBe("Hola & chau\nlinea");
  });
});

describe("recargo y redondeo", () => {
  it("redondea hacia arriba", () => {
    expect(roundPrice(12345, 10)).toBe(12350);
    expect(roundPrice(12345, 100)).toBe(12400);
    expect(roundPrice(12000, 1000)).toBe(12000);
    expect(roundPrice(12001, 1000)).toBe(13000);
    expect(roundPrice(12345, 990)).toBe(12990);
    expect(roundPrice(12990, 990)).toBe(12990);
    expect(roundPrice(12995, 990)).toBe(13990);
    expect(roundPrice(10.555, 0)).toBe(10.56);
  });
  it("aplica el markup", () => {
    expect(applyMarkup(10000, 40, 0)).toBe(14000);
    expect(applyMarkup(9000, 40, 990)).toBe(12990);
    expect(applyMarkup(null, 40, 0)).toBeNull();
  });
});

describe("WooCommerce → normalizado", () => {
  it("mapea un producto simple (DAZ)", () => {
    const p = mapWooProduct(JSON.parse(fixture("woo-simple.json")) as WooProduct);
    expect(p.externalId).toBe("49545");
    expect(p.slug).toBe("caja-de-pilas-om-aaa");
    expect(p.source_url).toBe("https://dazimportadora.com.ar/producto/caja-de-pilas-om-aaa/");
    expect(p.categories.map((c) => c.externalId)).toEqual(["209", "128"]);
    expect(p.tags).toEqual(["Pilas"]);
    expect(p.options).toEqual([]);
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0]).toMatchObject({ sku: "03050014", price: 9000, compare_at_price: null, option_values: {}, in_stock: true, stock: null });
    expect(p.images).toEqual(["https://dazimportadora.com.ar/wp-content/uploads/2025/01/Flash-39.png"]);
  });

  it("mapea un producto variable con sus variaciones", () => {
    const f = JSON.parse(fixture("woo-variable.json")) as { product: WooProduct; variations: WooProduct[] };
    const p = mapWooProduct(f.product, { variations: f.variations });
    expect(p.name).toBe("Remera Básica");
    expect(p.brand).toBe("Marca Sur");
    expect(p.short_description).toBe("Algodón peinado");
    expect(p.options).toEqual([
      { name: "Color", values: ["Negro", "Blanco"] },
      { name: "Talle", values: ["S", "M"] },
    ]);
    expect(p.variants).toEqual([
      expect.objectContaining({
        externalId: "501",
        sku: "REM-NEG-S",
        title: "Negro / S",
        option_values: { Color: "Negro", Talle: "S" },
        price: 10000,
        compare_at_price: 12000,
        stock: 3,
        in_stock: true,
        image_url: "https://tienda.example/img/remera-negra.jpg",
      }),
      expect.objectContaining({
        externalId: "502",
        title: "Blanco / M",
        price: 11000,
        compare_at_price: null,
        stock: 0,
        in_stock: false,
      }),
    ]);
  });

  it("mapea categorías con padre", () => {
    expect(mapWooCategory({ id: 31, name: "Remeras &amp; Tops", slug: "remeras", parent: 30 })).toEqual({
      externalId: "31",
      name: "Remeras & Tops",
      slug: "remeras",
      parentExternalId: "30",
    });
  });
});

describe("Shopify → normalizado", () => {
  it("mapea opciones, variantes, precios e imágenes por variante", () => {
    const p = mapShopifyProduct(JSON.parse(fixture("shopify-product.json")) as ShopifyProduct, "https://shop.example");
    expect(p.externalId).toBe("7001");
    expect(p.slug).toBe("zapatilla-runner");
    expect(p.brand).toBe("Allbirds");
    expect(p.source_url).toBe("https://shop.example/products/zapatilla-runner");
    expect(p.categories).toEqual([{ externalId: "type:calzado", name: "Calzado", slug: "calzado", parentExternalId: null }]);
    // Sólo los valores usados por alguna variante.
    expect(p.options).toEqual([
      { name: "Color", values: ["Negro"] },
      { name: "Talle", values: ["42", "43"] },
    ]);
    expect(p.variants[0]).toMatchObject({
      externalId: "1",
      sku: "RUN-NEG-42",
      option_values: { Color: "Negro", Talle: "42" },
      price: 120,
      compare_at_price: 150,
      in_stock: true,
      stock: null,
      image_url: "https://cdn.shopify.com/runner.jpg",
      weight_grams: 450,
    });
    expect(p.variants[1]).toMatchObject({ in_stock: false, stock: 0, image_url: "https://cdn.shopify.com/runner-43.jpg" });
    expect(p.images).toHaveLength(2);
  });

  it("un producto sin opciones queda con variante Default", () => {
    const p = mapShopifyProduct(
      {
        id: 1,
        title: "Gift card",
        handle: "gift",
        variants: [{ id: 9, title: "Default Title", option1: "Default Title", price: "10.00", available: true }],
        options: [{ name: "Title", values: ["Default Title"] }],
      },
      "https://s.example",
    );
    expect(p.options).toEqual([]);
    expect(p.variants[0]).toMatchObject({ title: "Default", option_values: {} });
  });
});

describe("extracción JSON-LD", () => {
  it("extrae Product dentro de @graph con precio tachado", () => {
    const p = extractProductFromHtml(fixture("jsonld-product.html"), "https://tienda.example/productos/mate-calabaza/?utm=1");
    expect(p).not.toBeNull();
    expect(p!.name).toBe("Mate de calabaza forrado");
    expect(p!.externalId).toBe("/productos/mate-calabaza");
    expect(p!.source_url).toBe("https://tienda.example/productos/mate-calabaza/");
    expect(p!.brand).toBe("Pampa");
    expect(p!.images).toEqual([
      "https://tienda.example/img/mate-1.jpg",
      "https://tienda.example/img/mate-2.jpg",
      "https://tienda.example/img/mate-og.jpg",
    ]);
    expect(p!.categories).toEqual([{ externalId: "path:hogar/mates", name: "Mates", slug: "mates", parentExternalId: "path:hogar" }]);
    expect(p!.categoryDefs).toEqual([{ externalId: "path:hogar", name: "Hogar", slug: "hogar", parentExternalId: null }]);
    expect(p!.variants).toEqual([
      expect.objectContaining({ sku: "MATE-01", barcode: "7790000000001", price: 15990, compare_at_price: 18990, in_stock: true }),
    ]);
    expect(p!.description_html).toBe("<p>Mate artesanal.</p><p>Incluye bombilla.</p>");
  });

  it("cae a Open Graph cuando no hay JSON-LD", () => {
    const p = extractProductFromHtml(fixture("og-only.html"), "https://otra.example/p/lampara-colgante?x=1");
    expect(p).toMatchObject({ name: "Lámpara colgante & pantalla", externalId: "/p/lampara-colgante" });
    expect(p!.variants[0]).toMatchObject({ price: 45500, in_stock: false, stock: 0 });
    expect(p!.images).toEqual(["https://otra.example/lampara.jpg"]);
  });

  it("devuelve null si la página no tiene producto", () => {
    expect(extractProductFromHtml("<html><head></head><body></body></html>", "https://x.example/")).toBeNull();
  });

  it("descubre links de producto y paginación", () => {
    const html = `<a href="/productos/a">A</a><a href="https://t.example/productos/b#x">B</a>
      <a href="https://otro.example/productos/c">C</a><a href="/carrito">Carrito</a><a rel="next" href="?page=2">2</a>`;
    expect(extractListingLinks(html, "https://t.example/tienda")).toEqual({
      products: ["https://t.example/productos/a", "https://t.example/productos/b"],
      next: "https://t.example/tienda?page=2",
    });
  });

  it("lee sitemaps e índices", () => {
    expect(parseSitemap(`<?xml version="1.0"?><sitemapindex><sitemap><loc>https://t.example/product-sitemap.xml</loc></sitemap></sitemapindex>`)).toEqual({
      isIndex: true,
      locs: ["https://t.example/product-sitemap.xml"],
    });
    expect(parseSitemap(`<urlset><url><loc> https://t.example/producto/x </loc></url></urlset>`).locs).toEqual(["https://t.example/producto/x"]);
  });
});

describe("CSV", () => {
  const existing = (over: Partial<ExistingVariant> = {}): ExistingVariant => ({
    variant_id: "v1",
    product_id: "p1",
    product_name: "Taza",
    product_status: "active",
    variant_title: "Default",
    sku: "TAZ-001",
    price: 5000,
    compare_at_price: null,
    cost: 2000,
    stock: 10,
    track_inventory: true,
    ...over,
  });

  it("detecta punto y coma, BOM y alias en castellano", () => {
    const parsed = parseCsvText("﻿SKU;Precio;Stock\nTAZ-001;5.500;12\n");
    expect(parsed.delimiter).toBe(";");
    expect(parsed.headers).toEqual(["sku", "price", "stock"]);
    expect(parsed.records).toEqual([{ sku: "TAZ-001", price: "5.500", stock: "12" }]);
  });

  it("arma el diff por fila (actualizar por SKU)", () => {
    const { records } = parseCsvText(
      [
        "sku,price,compare_at_price,cost,stock,status",
        "TAZ-001,5500,6000,,12,",
        "NOPE,100,,,,",
        "TAZ-002,abc,,,,",
        "TAZ-001,1,,,,",
        "TAZ-003,,,,,",
        ",10,,,,",
      ].join("\n"),
    );
    const { rows, errors } = parseUpdateRows(records);
    const index = new Map([
      ["taz-001", [existing()]],
      ["taz-003", [existing({ variant_id: "v3", sku: "TAZ-003" })]],
    ]);
    const diff = diffUpdateRows(rows, errors, index);
    expect(diff.map((d) => [d.line, d.kind])).toEqual([
      [2, "change"],
      [3, "error"],
      [4, "error"],
      [5, "error"],
      [6, "same"],
      [7, "error"],
    ]);
    expect(diff[0].changes).toEqual([
      { field: "price", from: 5000, to: 5500 },
      { field: "compare_at_price", from: null, to: 6000 },
      { field: "stock", from: 10, to: 12 },
    ]);
    expect(diff[1].error).toBe("SKU no encontrado.");
    expect(diff[2].error).toBe("Precio inválido.");
    expect(diff[3].error).toMatch(/repetido/);
  });

  it("quita el tachado si queda menor o igual al precio", () => {
    const { rows, errors } = parseUpdateRows([{ sku: "TAZ-001", price: "7000" }]);
    const diff = diffUpdateRows(rows, errors, new Map([["taz-001", [existing({ compare_at_price: 6500 })]]]));
    expect(diff[0].changes).toEqual([
      { field: "price", from: 5000, to: 7000 },
      { field: "compare_at_price", from: 6500, to: null },
    ]);
  });

  it("agrupa filas por handle en modo crear productos", () => {
    const { records } = parseCsvText(csvTemplate("create"));
    const { groups, errors } = parseCreateRows(records);
    expect(errors).toEqual([]);
    expect(groups.map((g) => g.handle)).toEqual(["remera-lisa", "taza-ceramica"]);
    const remera = groups[0].product;
    expect(remera.options).toEqual([
      { name: "Color", values: ["Negro"] },
      { name: "Talle", values: ["M", "L"] },
    ]);
    expect(remera.variants.map((v) => [v.sku, v.title, v.price, v.stock])).toEqual([
      ["REM-NEG-M", "Negro / M", 9990, 10],
      ["REM-NEG-L", "Negro / L", 9990, 8],
    ]);
    expect(remera.categories).toEqual([
      { externalId: "path:indumentaria/remeras", name: "Remeras", slug: "remeras", parentExternalId: "path:indumentaria" },
    ]);
    expect(remera.tags).toEqual(["algodón", "verano"]);
    expect(groups[1].product.seo).toEqual({ title: "Taza de cerámica 350 ml", description: "Taza apta microondas." });
    expect(groups[1].product.variants[0].barcode).toBe("7791234567890");
  });

  it("reporta errores por fila en modo crear", () => {
    const { records } = parseCsvText(
      ["name,price,option1_name,option1_value", "Taza,100,,", "Taza,120,,", "Vaso,xx,,", "Plato,50,Color,"].join("\n"),
    );
    const { groups, errors } = parseCreateRows(records);
    expect(groups.map((g) => g.handle)).toEqual(["taza"]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it("parsea rutas de categorías con varias ramas", () => {
    const r = parseCategoryPaths("Hogar > Cocina | Ofertas");
    expect(r.leaf.map((c) => c.externalId)).toEqual(["path:hogar/cocina", "path:ofertas"]);
    expect(r.defs.map((c) => c.externalId)).toEqual(["path:hogar"]);
  });
});

describe("utilidades", () => {
  it("descarta categorías vacías del origen", () => {
    expect(isJunkCategory("–")).toBe(true);
    expect(isJunkCategory(" - ")).toBe(true);
    expect(isJunkCategory("Uncategorized")).toBe(true);
    expect(isJunkCategory("Sin categoría")).toBe(true);
    expect(isJunkCategory("Hogar")).toBe(false);
  });
  it("pide la imagen original a la CDN de Shopify", () => {
    expect(fullSizeImage("https://www.tienda.com/cdn/shop/files/a.png?v=1&width=100")).toBe("https://www.tienda.com/cdn/shop/files/a.png?v=1");
    expect(fullSizeImage("https://otra.example/a.jpg?width=100")).toBe("https://otra.example/a.jpg?width=100");
  });
});
