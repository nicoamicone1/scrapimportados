import { describe, expect, it } from "vitest";

import { storePath, stripStoreBase } from "./urls";

describe("storePath", () => {
  const base = "/s/demo";

  it("sin basePath (subdominio / dominio propio) devuelve el path tal cual", () => {
    expect(storePath("/productos", "")).toBe("/productos");
    expect(storePath("/", "")).toBe("/");
    expect(storePath("/producto/mate?variant=1", "")).toBe("/producto/mate?variant=1");
  });

  it("antepone el prefijo a paths internos", () => {
    expect(storePath("/productos", base)).toBe("/s/demo/productos");
    expect(storePath("/producto/mate", base)).toBe("/s/demo/producto/mate");
    expect(storePath("categoria/remeras", base)).toBe("/s/demo/categoria/remeras");
  });

  it("home: sin barra final", () => {
    expect(storePath("/", base)).toBe("/s/demo");
  });

  it("conserva query y hash", () => {
    expect(storePath("/productos?q=mate&pagina=2", base)).toBe("/s/demo/productos?q=mate&pagina=2");
    expect(storePath("/politicas/envios#costos", base)).toBe("/s/demo/politicas/envios#costos");
    expect(storePath("/?ref=ig", base)).toBe("/s/demo?ref=ig");
    expect(storePath("/#como-comprar", base)).toBe("/s/demo#como-comprar");
  });

  it("no toca externos, protocolos, anclas ni queries sueltas", () => {
    expect(storePath("https://instagram.com/tienda", base)).toBe("https://instagram.com/tienda");
    expect(storePath("//cdn.example.com/a.png", base)).toBe("//cdn.example.com/a.png");
    expect(storePath("mailto:hola@tienda.com", base)).toBe("mailto:hola@tienda.com");
    expect(storePath("tel:+5491155551234", base)).toBe("tel:+5491155551234");
    expect(storePath("https://wa.me/5491155551234?text=hola", base)).toBe("https://wa.me/5491155551234?text=hola");
    expect(storePath("#contenido", base)).toBe("#contenido");
    expect(storePath("?pagina=2", base)).toBe("?pagina=2");
    expect(storePath("", base)).toBe("");
  });

  it("es idempotente", () => {
    const once = storePath("/productos?q=x", base);
    expect(storePath(once, base)).toBe(once);
    expect(storePath(storePath("/", base), base)).toBe("/s/demo");
    expect(storePath("/s/demo#top", base)).toBe("/s/demo#top");
    expect(storePath("/s/demo?x=1", base)).toBe("/s/demo?x=1");
  });

  it("no confunde otra tienda con prefijo parecido", () => {
    expect(storePath("/s/demo2/productos", base)).toBe("/s/demo/s/demo2/productos");
  });
});

describe("stripStoreBase", () => {
  it("quita el prefijo (inverso de storePath)", () => {
    expect(stripStoreBase("/s/demo", "/s/demo")).toBe("/");
    expect(stripStoreBase("/s/demo/productos", "/s/demo")).toBe("/productos");
    expect(stripStoreBase("/productos", "")).toBe("/productos");
    expect(stripStoreBase("/s/demo2/x", "/s/demo")).toBe("/s/demo2/x");
  });
});
