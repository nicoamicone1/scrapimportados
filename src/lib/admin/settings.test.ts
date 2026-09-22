import { describe, expect, it } from "vitest";

import { diffLines, flatDiff } from "@/lib/admin/diff";
import { csvCell, csvLine, parseCsv, toCsv } from "@/lib/admin/csv";
import { can } from "@/lib/admin/permissions";
import { fillLegalTemplate, LEGAL_TEMPLATES, renderLegalTemplate } from "@/lib/legal/templates";
import {
  extractSiteVerification,
  formatCuit,
  isValidAlias,
  isValidCbu,
  isValidCuit,
  isValidE164,
  normalizeFromPath,
  normalizePhone,
  paymentsSettingsSchema,
  redirectSchema,
  seoSettingsSchema,
  storeSettingsSchema,
} from "@/lib/schemas/settings";

describe("validadores AR", () => {
  it("CBU: 22 dígitos con verificadores", () => {
    expect(isValidCbu("9990001800000123456784")).toBe(true);
    expect(isValidCbu("2850590940090418135201")).toBe(true); // CBU de ejemplo público
    expect(isValidCbu("9990001800000123456785")).toBe(false); // verificador 2 mal
    expect(isValidCbu("9990002800000123456784")).toBe(false); // verificador 1 mal
    expect(isValidCbu("999000180000012345678")).toBe(false); // 21 dígitos
    expect(isValidCbu("99900018000001234567a4")).toBe(false);
    expect(isValidCbu("9990001 8000001 23456784")).toBe(true); // espacios tolerados
  });

  it("CUIT: prefijo y dígito verificador", () => {
    expect(isValidCuit("20-12345678-6")).toBe(true);
    expect(isValidCuit("20123456786")).toBe(true);
    expect(isValidCuit("30-71234567-1")).toBe(true);
    expect(isValidCuit("20-12345678-5")).toBe(false);
    expect(isValidCuit("99-12345678-6")).toBe(false);
    expect(isValidCuit("20-1234567-6")).toBe(false);
    expect(formatCuit("30712345671")).toBe("30-71234567-1");
  });

  it("alias CBU", () => {
    expect(isValidAlias("ECOMMY.DEMO")).toBe(true);
    expect(isValidAlias("mi-alias.123")).toBe(true);
    expect(isValidAlias("corto")).toBe(false);
    expect(isValidAlias("con espacio.x")).toBe(false);
    expect(isValidAlias("a".repeat(21))).toBe(false);
  });

  it("E.164 sin +", () => {
    expect(normalizePhone("+54 9 11 2345-6789")).toBe("5491123456789");
    expect(isValidE164("5491123456789")).toBe(true);
    expect(isValidE164("01123456789")).toBe(false);
    expect(isValidE164("1234567")).toBe(false);
    expect(isValidE164("1234567890123456")).toBe(false);
  });
});

describe("schemas de configuración", () => {
  const store = {
    name: " Mi tienda ",
    tagline: "",
    contact_email: "Hola@Tienda.com",
    contact_phone: "",
    whatsapp_phone: "+54 9 381 617-3548",
    address: "",
    currency: "ARS",
    locale: "es-AR",
    timezone: "America/Argentina/Buenos_Aires",
    social: { instagram: "https://instagram.com/x", facebook: "", tiktok: "", x: "", youtube: "" },
  };

  it("tienda: normaliza y convierte vacíos en null", () => {
    const r = storeSettingsSchema.parse(store);
    expect(r.name).toBe("Mi tienda");
    expect(r.tagline).toBeNull();
    expect(r.contact_email).toBe("hola@tienda.com");
    expect(r.whatsapp_phone).toBe("5493816173548");
  });

  it("tienda: rechaza WhatsApp inválido y redes sin https", () => {
    const r = storeSettingsSchema.safeParse({ ...store, whatsapp_phone: "011 4444", social: { ...store.social, x: "x.com/tienda" } });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("whatsapp_phone");
    expect(paths).toContain("social.x");
  });

  it("pagos: porcentaje 0-100, CBU, CUIT y reserva", () => {
    const base = {
      methods: [
        { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", code: "transfer", type: "transfer", name: "Transferencia", is_active: true, discount_percent: "10", instructions_md: "" },
      ],
      transfer: { bank_name: "Banco Ejemplo", holder: "Ecommy Demo S.A.", cbu: "9990001800000123456784", alias: "ecommy.demo", cuit: "30712345671", instructions_md: "" },
      whatsapp_template: "Hola #{number}",
      require_phone: true,
      order_notes_enabled: true,
      min_order_total: "0",
      reservation_hours: "48",
      inventory_policy: "on_order",
      low_stock_threshold: "5",
      out_of_stock_display: "show_last",
      free_shipping_bar: { enabled: true, threshold: "" },
      whatsapp_button: { enabled: true, position: "right", message_template: "", show_on_mobile: true, show_on_desktop: true },
    };
    const ok = paymentsSettingsSchema.parse(base);
    expect(ok.transfer.alias).toBe("ECOMMY.DEMO");
    expect(ok.transfer.cuit).toBe("30-71234567-1");
    expect(ok.methods[0].discount_percent).toBe(10);
    expect(ok.free_shipping_bar.threshold).toBeNull();
    expect(ok.reservation_hours).toBe(48);

    const bad = paymentsSettingsSchema.safeParse({
      ...base,
      methods: [{ ...base.methods[0], discount_percent: "120" }],
      transfer: { ...base.transfer, cbu: "123" },
      reservation_hours: "1.5",
    });
    expect(bad.success).toBe(false);
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["methods.0.discount_percent", "transfer.cbu", "reservation_hours"]));
  });

  it("integraciones: IDs con formato y meta tag de verificación", () => {
    const r = seoSettingsSchema.parse({
      seo: { title: "", description: "", og_image_url: "" },
      integrations: {
        ga4_id: "g-abc123xyz9",
        gtm_id: "",
        meta_pixel_id: "123456789012345",
        google_site_verification: '<meta name="google-site-verification" content="abcDEF123_-xyz" />',
      },
      maintenance: { enabled: false, message: "" },
    });
    expect(r.integrations.ga4_id).toBe("G-ABC123XYZ9");
    expect(r.integrations.gtm_id).toBeNull();
    expect(r.integrations.google_site_verification).toBe("abcDEF123_-xyz");
    expect(extractSiteVerification("token12345")).toBe("token12345");
    expect(
      seoSettingsSchema.safeParse({
        seo: { title: "", description: "", og_image_url: "" },
        integrations: { ga4_id: "UA-1234", gtm_id: "", meta_pixel_id: "abc", google_site_verification: "" },
        maintenance: { enabled: false, message: "" },
      }).success,
    ).toBe(false);
  });

  it("redirecciones: origen interno, distinto del destino", () => {
    expect(normalizeFromPath("https://vieja.com/producto/x/")).toBe("/producto/x");
    expect(redirectSchema.parse({ from_path: "/viejo/", to_path: "/nuevo" }).from_path).toBe("/viejo");
    expect(redirectSchema.safeParse({ from_path: "viejo", to_path: "/nuevo" }).success).toBe(false);
    expect(redirectSchema.safeParse({ from_path: "/a", to_path: "/a" }).success).toBe(false);
    expect(redirectSchema.safeParse({ from_path: "/a", to_path: "javascript:alert(1)" }).success).toBe(false);
    expect(redirectSchema.safeParse({ from_path: "/admin", to_path: "/x" }).success).toBe(false);
    expect(redirectSchema.safeParse({ from_path: "/a", to_path: "https://otra.com/a" }).success).toBe(true);
  });
});

describe("plantillas legales", () => {
  it("reemplaza variables y marca las faltantes", () => {
    const out = fillLegalTemplate("{{store.name}} · {{ store.cuit }} · {{store.email}} · {{store.otro}}", {
      name: "Mi tienda",
      cuit: "30-71234567-1",
      email: "",
    });
    expect(out).toBe("Mi tienda · 30-71234567-1 · [email de contacto] · {{store.otro}}");
  });

  it("las 4 plantillas quedan sin variables al completar todo", () => {
    const vars = { name: "T", razon_social: "R S.A.", cuit: "30-71234567-1", email: "a@b.com", address: "Calle 1" };
    for (const key of Object.keys(LEGAL_TEMPLATES) as (keyof typeof LEGAL_TEMPLATES)[]) {
      const text = renderLegalTemplate(key, vars);
      expect(text).not.toMatch(/\{\{/);
      expect(text).not.toMatch(/\[(nombre|CUIT|razón)/);
    }
    expect(renderLegalTemplate("returns_md", vars)).toMatch(/10 \(diez\) días corridos/);
    expect(renderLegalTemplate("privacy_md", vars)).toMatch(/Ley 25\.326/);
  });
});

describe("CSV", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Remera "básica"')).toBe('"Remera ""básica"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
    expect(csvCell(" borde")).toBe('" borde"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(1234.5)).toBe("1234.5");
    expect(csvCell(false)).toBe("false");
    expect(csvCell("=SUMA(A1)")).toBe("'=SUMA(A1)");
    expect(csvCell("+5491112345678")).toBe("+5491112345678");
    expect(csvCell(new Date("2026-09-22T12:00:00Z"))).toBe("2026-09-22T12:00:00.000Z");
    expect(csvLine(["a", 1, null])).toBe("a,1,\r\n");
  });

  it("toCsv agrega BOM y parseCsv lo lee de vuelta", () => {
    const csv = toCsv(["from", "to"], [["/a", "/b"], ['/c,"d"', "línea\nnueva"]]);
    expect(csv.startsWith("﻿from,to\r\n")).toBe(true);
    expect(parseCsv(csv)).toEqual([
      ["from", "to"],
      ["/a", "/b"],
      ['/c,"d"', "línea\nnueva"],
    ]);
    expect(parseCsv("from;to\n/x;/y\n\n")).toEqual([
      ["from", "to"],
      ["/x", "/y"],
    ]);
  });
});

describe("permisos", () => {
  it("staff no configura ni cambia precios en masa", () => {
    expect(can({ role: "owner", is_active: true }, "users.manage")).toBe(true);
    expect(can({ role: "admin", is_active: true }, "users.manage")).toBe(false);
    expect(can({ role: "admin", is_active: true }, "settings.write")).toBe(true);
    expect(can({ role: "staff", is_active: true }, "settings.write")).toBe(false);
    expect(can({ role: "staff", is_active: true }, "prices.bulk")).toBe(false);
    expect(can({ role: "owner", is_active: false }, "settings.write")).toBe(false);
    expect(can(null, "export")).toBe(false);
  });
});

describe("diff de auditoría", () => {
  it("aplana objetos y formatea líneas", () => {
    const d = flatDiff({ a: 1, t: { cbu: "1", alias: "X" }, l: [1] }, { a: 1, t: { cbu: "2", alias: "X" }, l: [1, 2], n: true });
    expect(d).toEqual({ "t.cbu": ["1", "2"], l: [[1], [1, 2]], n: [null, true] });
    expect(diffLines(d)).toEqual([
      { field: "t.cbu", before: "1", after: "2" },
      { field: "l", before: "[1]", after: "[1,2]" },
      { field: "n", before: "vacío", after: "sí" },
    ]);
    expect(diffLines({ status: { from: "pending", to: "paid" } })).toEqual([{ field: "status", before: "pending", after: "paid" }]);
  });
});

describe("rangos de fecha", () => {
  it("usa la zona horaria de la tienda", async () => {
    const { zonedDayRange } = await import("@/lib/admin/csv");
    expect(zonedDayRange("2026-09-01", "2026-09-30", "America/Argentina/Buenos_Aires")).toEqual({
      fromIso: "2026-09-01T03:00:00.000Z",
      toIso: "2026-10-01T03:00:00.000Z",
    });
    expect(zonedDayRange(null, "", "Europe/Madrid")).toEqual({ fromIso: null, toIso: null });
  });
});
