import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PLATFORM_EMAIL, PLATFORM_OWNER } from "@/components/platform/site";
import sitemap from "@/app/sitemap";

import { OwnerStatement, platformMailto } from "./public-site";

vi.mock("server-only", () => ({}));

const original = { ...PLATFORM_OWNER };
afterEach(() => Object.assign(PLATFORM_OWNER, original));

const ownerText = () => renderToStaticMarkup(createElement(OwnerStatement)).replace(/<[^>]+>/g, "");

describe("platformMailto", () => {
  it("arma el mailto con asunto y cuerpo codificados", () => {
    expect(platformMailto()).toBe(`mailto:${PLATFORM_EMAIL}`);
    expect(platformMailto("Plan Business", "Hola,\nqué tal")).toBe(
      `mailto:${PLATFORM_EMAIL}?subject=Plan%20Business&body=Hola%2C%0Aqu%C3%A9%20tal`,
    );
  });
});

describe("OwnerStatement", () => {
  it("sin datos del titular, dice que se informan a pedido por mail", () => {
    Object.assign(PLATFORM_OWNER, { name: null, taxId: null, address: null });
    const text = ownerText();
    expect(text).toContain("Los datos de su titular (nombre o razón social, CUIT y domicilio) se informan a pedido");
    expect(text).toContain(PLATFORM_EMAIL);
  });

  it("con todos los datos, los muestra y no pide escribir", () => {
    Object.assign(PLATFORM_OWNER, { name: "Ejemplo SRL", taxId: "30-00000000-0", address: "Calle 123, Tucumán" });
    const text = ownerText();
    expect(text).toBe("Ecommy lo presta Ejemplo SRL, CUIT 30-00000000-0, con domicilio en Calle 123, Tucumán.");
  });

  it("con datos parciales, pide sólo los que faltan", () => {
    Object.assign(PLATFORM_OWNER, { name: "Ejemplo SRL", taxId: null, address: null });
    expect(ownerText()).toContain("Los demás datos del titular (CUIT y domicilio) se informan a pedido");
  });
});

describe("sitemap de la plataforma", () => {
  it("incluye contacto y legales", () => {
    const paths = sitemap().map((e) => new URL(e.url).pathname);
    expect(paths).toEqual(expect.arrayContaining(["/", "/planes", "/contacto", "/terminos", "/privacidad"]));
  });
});
