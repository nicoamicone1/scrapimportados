import { describe, expect, it } from "vitest";

import { googleSiteVerification, platformGa4Id } from "./analytics";

describe("platformGa4Id", () => {
  it("acepta un ID de GA4 y lo normaliza", () => {
    expect(platformGa4Id("G-ABC123XYZ")).toBe("G-ABC123XYZ");
    expect(platformGa4Id("  g-abc123xyz ")).toBe("G-ABC123XYZ");
  });

  it("rechaza vacío, otros formatos y cualquier cosa interpolable en el script", () => {
    expect(platformGa4Id(undefined)).toBeNull();
    expect(platformGa4Id("")).toBeNull();
    expect(platformGa4Id("UA-12345-1")).toBeNull();
    expect(platformGa4Id("GTM-ABCD12")).toBeNull();
    expect(platformGa4Id("G-ABC');alert(1);('")).toBeNull();
  });
});

describe("googleSiteVerification", () => {
  it("acepta el token de Search Console y rechaza lo demás", () => {
    expect(googleSiteVerification("abcDEF123_-abcDEF123_-abc")).toBe("abcDEF123_-abcDEF123_-abc");
    expect(googleSiteVerification(undefined)).toBeNull();
    expect(googleSiteVerification("corto")).toBeNull();
    expect(googleSiteVerification('x"><script>'.padEnd(20, "a"))).toBeNull();
  });
});
