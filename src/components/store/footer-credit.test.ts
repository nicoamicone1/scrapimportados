import { describe, expect, it } from "vitest";

import { creditHref } from "./Footer";

describe("creditHref", () => {
  it("lleva a la landing con UTM de tienda y el slug como campaña", () => {
    expect(creditHref("luna-indumentaria", "ecommy.app")).toBe(
      "https://ecommy.app/?utm_source=tienda&utm_medium=credito&utm_campaign=luna-indumentaria",
    );
  });

  it("en modo fallback (localhost) queda relativo a la plataforma", () => {
    expect(creditHref("demo", "localhost:3000")).toBe("/?utm_source=tienda&utm_medium=credito&utm_campaign=demo");
  });

  it("sin slug, o con un slug que no tiene forma de slug, no manda campaña", () => {
    expect(creditHref(undefined, "ecommy.app")).toBe("https://ecommy.app/?utm_source=tienda&utm_medium=credito");
    expect(creditHref("", "ecommy.app")).toBe("https://ecommy.app/?utm_source=tienda&utm_medium=credito");
    expect(creditHref("mi tienda&x=1", "ecommy.app")).toBe("https://ecommy.app/?utm_source=tienda&utm_medium=credito");
    expect(creditHref("-raro-", "ecommy.app")).toBe("https://ecommy.app/?utm_source=tienda&utm_medium=credito");
  });

  it("normaliza mayúsculas y espacios", () => {
    expect(creditHref("  Luna  ", "ecommy.app")).toContain("utm_campaign=luna");
  });
});
