import { describe, expect, it } from "vitest";

import { PRESETS } from "@/lib/theme/presets";

import { announcementSchema, CUSTOM_CSS_MAX_BYTES, saveThemeSchema, validateCustomCss } from "./appearance";

describe("validateCustomCss", () => {
  it("acepta CSS común", () => {
    expect(validateCustomCss("")).toEqual([]);
    expect(validateCustomCss(".store-root h1 { letter-spacing: -0.03em; }\n/* comentario } */")).toEqual([]);
    expect(validateCustomCss('a::after { content: "}"; }')).toEqual([]);
  });

  it("rechaza @import con número de línea", () => {
    const issues = validateCustomCss("h1{color:red}\n@import url('https://evil.test/x.css');");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ line: 2 });
  });

  it("rechaza url(javascript:), expression() y behavior", () => {
    expect(validateCustomCss("a{background:url( 'javascript:alert(1)')}").length).toBe(1);
    expect(validateCustomCss("a{background:url(JAVASCRIPT:alert(1))}").length).toBe(1);
    expect(validateCustomCss("a{width:expression(alert(1))}").length).toBe(1);
    expect(validateCustomCss("a{behavior: url(x.htc)}").length).toBe(1);
  });

  it("detecta patrones partidos en varias líneas", () => {
    expect(validateCustomCss("a{background:url(\n  javascript:alert(1))}").length).toBeGreaterThan(0);
  });

  it("rechaza etiquetas y llaves desbalanceadas", () => {
    expect(validateCustomCss("</style><script>alert(1)</script>").length).toBeGreaterThan(0);
    expect(validateCustomCss("h1 { color: red;").map((i) => i.message).join()).toMatch(/llaves/);
    expect(validateCustomCss("h1 { color: red; }}").map((i) => i.message).join()).toMatch(/llaves/);
  });

  it("limita a 20 KB", () => {
    const big = `/*${"x".repeat(CUSTOM_CSS_MAX_BYTES)}*/`;
    expect(validateCustomCss(big)[0].message).toMatch(/20 KB/);
  });

  it("saveThemeSchema propaga los errores de custom_css", () => {
    expect(saveThemeSchema.safeParse({ ...PRESETS.atelier, custom_css: "h1{}" }).success).toBe(true);
    const bad = saveThemeSchema.safeParse({ ...PRESETS.atelier, custom_css: "@import 'x';" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].path).toEqual(["custom_css"]);
  });
});

describe("announcementSchema", () => {
  it("exige texto si está activa y los dos colores juntos", () => {
    expect(announcementSchema.safeParse({ enabled: true, text: "" }).success).toBe(false);
    expect(announcementSchema.safeParse({ enabled: true, text: "Envíos gratis", bg: "#000000" }).success).toBe(false);
    expect(announcementSchema.safeParse({ enabled: true, text: "Envíos gratis", bg: "#000000", fg: "#FFFFFF" }).success).toBe(true);
    expect(announcementSchema.safeParse({ enabled: false, text: "", href: "javascript:alert(1)" }).success).toBe(false);
  });
});
