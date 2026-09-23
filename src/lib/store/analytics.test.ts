import { describe, expect, it } from "vitest";

import { safePageLocation } from "./analytics";

describe("safePageLocation", () => {
  it("saca el token de /pedido/<token> (host de tienda y /s/<slug>)", () => {
    expect(safePageLocation("https://luna.ecommy.app/pedido/0123abcd?nuevo=1")).toBe("https://luna.ecommy.app/pedido?nuevo=1");
    expect(safePageLocation("https://www.ecommy.app/s/luna/pedido/0123abcd")).toBe("https://www.ecommy.app/s/luna/pedido");
  });

  it("saca el token de /carrito/recuperar/<token> (link del mail de carrito abandonado)", () => {
    const token = "0123456789abcdef".repeat(3);
    expect(safePageLocation(`https://luna.ecommy.app/carrito/recuperar/${token}?baja=1`)).toBe("https://luna.ecommy.app/carrito/recuperar?baja=1");
    expect(safePageLocation(`https://www.ecommy.app/s/luna/carrito/recuperar/${token}`)).toBe("https://www.ecommy.app/s/luna/carrito/recuperar");
    expect(safePageLocation("https://luna.ecommy.app/carrito")).toBe("https://luna.ecommy.app/carrito");
  });

  it("no toca otras rutas", () => {
    expect(safePageLocation("https://luna.ecommy.app/producto/pedido-especial")).toBe("https://luna.ecommy.app/producto/pedido-especial");
    expect(safePageLocation("https://luna.ecommy.app/checkout")).toBe("https://luna.ecommy.app/checkout");
  });
});
