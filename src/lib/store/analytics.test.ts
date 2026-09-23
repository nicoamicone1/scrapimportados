import { describe, expect, it } from "vitest";

import { safePageLocation } from "./analytics";

describe("safePageLocation", () => {
  it("saca el token de /pedido/<token> (host de tienda y /s/<slug>)", () => {
    expect(safePageLocation("https://luna.ecommy.app/pedido/0123abcd?nuevo=1")).toBe("https://luna.ecommy.app/pedido?nuevo=1");
    expect(safePageLocation("https://www.ecommy.app/s/luna/pedido/0123abcd")).toBe("https://www.ecommy.app/s/luna/pedido");
  });

  it("no toca otras rutas", () => {
    expect(safePageLocation("https://luna.ecommy.app/producto/pedido-especial")).toBe("https://luna.ecommy.app/producto/pedido-especial");
    expect(safePageLocation("https://luna.ecommy.app/checkout")).toBe("https://luna.ecommy.app/checkout");
  });
});
