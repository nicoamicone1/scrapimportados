import { describe, expect, it } from "vitest";

import {
  catalogReplyText,
  catalogRequestEmail,
  catalogRequestSchema,
  catalogRequestSubject,
  catalogWhatsappText,
  createRateLimiter,
  normalizeInstagram,
  normalizeWhatsapp,
  whatsappIntl,
  type CatalogRequest,
} from "./lead";

const lead: CatalogRequest = { instagram: "luna.ropa", whatsapp: "1155555555", products: "30-100", kind: "moda" };

describe("pedido de carga de catálogo (/empezar)", () => {
  it("normaliza el usuario de Instagram desde lo que se suele pegar", () => {
    expect(normalizeInstagram("@Luna.Ropa")).toBe("luna.ropa");
    expect(normalizeInstagram("  luna_ropa ")).toBe("luna_ropa");
    expect(normalizeInstagram("https://www.instagram.com/luna.ropa/?igsh=abc")).toBe("luna.ropa");
    expect(normalizeInstagram("instagram.com/luna.ropa")).toBe("luna.ropa");
    expect(normalizeInstagram("")).toBeNull();
    expect(normalizeInstagram("@")).toBeNull();
    expect(normalizeInstagram("luna ropa!")).toBeNull();
    expect(normalizeInstagram(".luna")).toBeNull();
    expect(normalizeInstagram("a".repeat(31))).toBeNull();
  });

  it("acepta teléfonos de 8 a 15 dígitos y arma el número internacional argentino", () => {
    expect(normalizeWhatsapp("11 5555-5555")).toBe("1155555555");
    expect(normalizeWhatsapp("1234")).toBeNull();
    expect(whatsappIntl("1155555555")).toBe("5491155555555");
    expect(whatsappIntl("03815555555")).toBe("5493815555555");
    expect(whatsappIntl("541155555555")).toBe("5491155555555");
    expect(whatsappIntl("5491155555555")).toBe("5491155555555");
  });

  it("valida el formulario con errores por campo", () => {
    const okParse = catalogRequestSchema.safeParse({ instagram: "@Luna.Ropa", whatsapp: "+54 9 11 5555-5555", products: "hasta-30", kind: "moda" });
    expect(okParse.success && okParse.data).toMatchObject({ instagram: "luna.ropa", whatsapp: "5491155555555", products: "hasta-30", kind: "moda" });

    const bad = catalogRequestSchema.safeParse({ instagram: "", whatsapp: "12", products: "mil", kind: "pescaderia" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(new Set(bad.error.issues.map((i) => i.path[0]))).toEqual(new Set(["instagram", "whatsapp", "products", "kind"]));
  });

  it("arma el asunto con usuario, rubro y cantidad", () => {
    expect(catalogRequestSubject(lead)).toBe("Pedido de catálogo: @luna.ropa · Moda y accesorios · 30 a 100 productos");
    expect(catalogRequestSubject({ ...lead, products: "mas-300", kind: "gourmet" })).toBe(
      "Pedido de catálogo: @luna.ropa · Vinos y gourmet · más de 300 productos",
    );
  });

  it("prellena el WhatsApp con el usuario", () => {
    expect(catalogWhatsappText(lead).startsWith("Hola, soy @luna.ropa, quiero que me carguen el catálogo.")).toBe(true);
    expect(catalogWhatsappText(lead)).toContain("Moda y accesorios · 30 a 100 productos");
  });

  it("el aviso interno trae los datos y el link para escribirle", () => {
    const mail = catalogRequestEmail(lead, { platformUrl: "https://www.ecommy.app", requestedAt: "2026-10-06T15:00:00.000Z" });
    expect(mail.subject).toBe(catalogRequestSubject(lead));
    expect(mail.text).toContain("@luna.ropa");
    expect(mail.text).toContain("+5491155555555");
    expect(mail.text).toContain("30 a 100");
    expect(mail.html).toContain(`https://wa.me/5491155555555?text=${encodeURIComponent(catalogReplyText(lead))}`.replace(/&/g, "&amp;"));
    expect(mail.html).toContain("https://www.instagram.com/luna.ropa/");
  });

  it("el cupo corta después de `max` pedidos por clave y se libera con la ventana", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxKeys: 2 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 10)).toBe(true);
    expect(limiter.hit("a", 20)).toBe(false);
    expect(limiter.hit("a", 1015)).toBe(true);
    // Con el tope de claves, la más vieja se descarta.
    expect(limiter.hit("b", 1020)).toBe(true);
    expect(limiter.hit("c", 1030)).toBe(true);
    expect(limiter.hit("a", 1040)).toBe(true);
  });
});
