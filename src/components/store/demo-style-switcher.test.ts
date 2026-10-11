import { describe, expect, it } from "vitest";

import { FOOTER_LEGAL_BAND, isFooterEndVisible, isHiddenPath, styleHref } from "./DemoStyleSwitcher";

describe("styleHref", () => {
  it("conserva la ruta y pone el estilo", () => {
    expect(styleHref("/s/demo/productos", "", "nordico")).toBe("/s/demo/productos?estilo=nordico");
    expect(styleHref("/producto/remera-luna", "", "neon")).toBe("/producto/remera-luna?estilo=neon");
  });

  it("vuelve al diseño original con estilo=original", () => {
    expect(styleHref("/s/demo", "?estilo=neon", null)).toBe("/s/demo?estilo=original");
  });

  it("conserva filtros y búsqueda, pisa el estilo anterior y saca la página", () => {
    const href = styleHref("/s/demo/productos", "?q=lino&orden=precio&pagina=3&estilo=bodega", "atelier");
    expect(href).toBe("/s/demo/productos?q=lino&orden=precio&estilo=atelier");
    expect(styleHref("/productos", "page=2&cat=vestidos", "recreo")).toBe("/productos?cat=vestidos&estilo=recreo");
  });

  it("con ruta vacía usa la raíz", () => {
    expect(styleHref("", "", "galpon")).toBe("/?estilo=galpon");
  });

  it("los ids de preset pasan el filtro del proxy (/^[a-z]{3,20}$/)", () => {
    const value = new URLSearchParams(styleHref("/", "", "lapacho").split("?")[1]).get("estilo");
    expect(value).toMatch(/^[a-z]{3,20}$/);
  });
});

describe("isHiddenPath", () => {
  it("se oculta en el checkout y en el pedido, con o sin prefijo de tienda", () => {
    expect(isHiddenPath("/checkout")).toBe(true);
    expect(isHiddenPath("/s/demo/checkout/envio")).toBe(true);
    expect(isHiddenPath("/s/demo/pedido/abc123")).toBe(true);
  });

  it("se muestra en el resto de la tienda", () => {
    expect(isHiddenPath("/")).toBe(false);
    expect(isHiddenPath("/s/demo")).toBe(false);
    expect(isHiddenPath("/s/demo/productos")).toBe(false);
    expect(isHiddenPath("/producto/pedidos-especiales")).toBe(false);
  });
});

describe("isFooterEndVisible", () => {
  it("se corre cuando el final del pie (zona legal) entra en la ventana", () => {
    expect(isFooterEndVisible(900 + FOOTER_LEGAL_BAND - 1, 900)).toBe(true);
    expect(isFooterEndVisible(850, 900)).toBe(true);
  });

  it("se queda mientras el pie está lejos o sólo asoma su parte de arriba", () => {
    expect(isFooterEndVisible(3000, 900)).toBe(false);
    expect(isFooterEndVisible(900 + FOOTER_LEGAL_BAND, 900)).toBe(false);
  });
});
