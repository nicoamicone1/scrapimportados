import { describe, expect, it } from "vitest";

import { hasModule, isModuleCode, isModuleLive, MODULE_CODES, MODULES, modulesTag, moduleState, normalizeModuleCodes } from "./registry";

describe("registry", () => {
  it("cada app tiene su menú colgado de adminHref", () => {
    for (const code of MODULE_CODES) {
      const m = MODULES[code];
      expect(m.code).toBe(code);
      expect(m.adminHref.startsWith("/admin/")).toBe(true);
      expect(m.nav[0].href).toBe(m.adminHref);
      for (const item of m.nav) expect(item.href === m.adminHref || item.href.startsWith(`${m.adminHref}/`)).toBe(true);
    }
    expect(MODULES.print3d.storefrontPaths).toEqual(["impresion-3d"]);
  });

  it("isModuleCode y normalizeModuleCodes descartan códigos desconocidos", () => {
    expect(isModuleCode("print3d")).toBe(true);
    expect(isModuleCode("otra")).toBe(false);
    expect(isModuleCode(null)).toBe(false);
    expect(normalizeModuleCodes(["x", "print3d", "print3d", 3])).toEqual(["print3d"]);
  });

  it("hasModule mira ctx.modules", () => {
    expect(hasModule({ modules: ["print3d"] }, "print3d")).toBe(true);
    expect(hasModule({ modules: [] }, "print3d")).toBe(false);
  });

  it("modulesTag arma el tag por tienda", () => {
    expect(modulesTag("abc")).toBe("modules:abc");
  });
});

describe("isModuleLive (espejo de store_has_module)", () => {
  const now = new Date("2026-09-29T12:00:00Z");

  it("activa o en prueba sin vencimiento", () => {
    expect(isModuleLive({ status: "active", expires_at: null }, now)).toBe(true);
    expect(isModuleLive({ status: "trial", expires_at: null }, now)).toBe(true);
  });

  it("desactivada o con estado raro, nunca", () => {
    expect(isModuleLive({ status: "disabled", expires_at: null }, now)).toBe(false);
    expect(isModuleLive({ status: "whatever", expires_at: null }, now)).toBe(false);
  });

  it("respeta el vencimiento", () => {
    expect(isModuleLive({ status: "trial", expires_at: "2026-09-30T00:00:00Z" }, now)).toBe(true);
    expect(isModuleLive({ status: "trial", expires_at: "2026-09-29T12:00:00Z" }, now)).toBe(false);
    expect(isModuleLive({ status: "active", expires_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    expect(isModuleLive({ status: "active", expires_at: "no-es-fecha" }, now)).toBe(false);
  });
});

describe("moduleState", () => {
  const now = new Date("2026-09-29T12:00:00Z");

  it("sin fila o desactivada → off", () => {
    expect(moduleState(null, now)).toEqual({ kind: "off" });
    expect(moduleState({ status: "disabled", expires_at: "2027-01-01T00:00:00Z" }, now)).toEqual({ kind: "off" });
  });

  it("vigente → active/trial con su vencimiento", () => {
    expect(moduleState({ status: "active", expires_at: null }, now)).toEqual({ kind: "active", expiresAt: null });
    expect(moduleState({ status: "trial", expires_at: "2026-10-10T00:00:00Z" }, now)).toEqual({ kind: "trial", expiresAt: "2026-10-10T00:00:00Z" });
  });

  it("vencida → expired", () => {
    expect(moduleState({ status: "trial", expires_at: "2026-09-01T00:00:00Z" }, now)).toEqual({ kind: "expired", expiresAt: "2026-09-01T00:00:00Z" });
  });
});
