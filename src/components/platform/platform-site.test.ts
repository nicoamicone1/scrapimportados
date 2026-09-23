import { describe, expect, it } from "vitest";

import { PLAN_CODES, PLAN_DEFAULTS, PLAN_NAMES } from "@/lib/plans";
import { STORE_KINDS } from "@/lib/tenant/kinds";
import { PRESETS } from "@/lib/theme";

import { pickFaq, platformFaq } from "./faq";
import { exampleStoreAddress, formatLegalDate, platformWhatsappHref } from "./site";
import { glyphSubset, presetMinPlan, presetSpecimens, SPECIMEN_PRODUCTS, specimenFontsHref } from "./specimens";

const plans = PLAN_CODES.map((code) => ({ code, name: PLAN_NAMES[code], features: PLAN_DEFAULTS[code].features }));

describe("site", () => {
  it("formatea la fecha de los legales sin correrse de día", () => {
    expect(formatLegalDate("2026-09-23")).toBe("23 de septiembre de 2026");
    expect(formatLegalDate("2027-01-01")).toBe("1 de enero de 2027");
  });

  it("arma el link de WhatsApp sólo con un número válido", () => {
    expect(platformWhatsappHref(undefined)).toBeNull();
    expect(platformWhatsappHref("")).toBeNull();
    expect(platformWhatsappHref("abc")).toBeNull();
    expect(platformWhatsappHref("+54 9 381 617-3548")).toBe("https://wa.me/5493816173548");
    expect(platformWhatsappHref("5493816173548", "Hola, ¿qué tal?")).toBe(
      "https://wa.me/5493816173548?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F",
    );
  });

  it("muestra la dirección de ejemplo según el modo de tiendas", () => {
    expect(exampleStoreAddress("taller-luna", "ecommy.app")).toBe("taller-luna.ecommy.app");
    expect(exampleStoreAddress("taller-luna", "localhost:3000")).toMatch(/\/s\/taller-luna$/);
  });
});

describe("faq", () => {
  const faq = platformFaq({ storeAddress: "tu-tienda.ecommy.app" });

  it("no repite preguntas ni ids", () => {
    expect(new Set(faq.map((f) => f.id)).size).toBe(faq.length);
    expect(new Set(faq.map((f) => f.q)).size).toBe(faq.length);
  });

  it("elige en el orden pedido", () => {
    expect(pickFaq(faq, ["datos", "comision"]).map((f) => f.id)).toEqual(["datos", "comision"]);
  });

  it("usa la dirección del entorno", () => {
    expect(pickFaq(faq, ["dominio"])[0].a).toContain("tu-tienda.ecommy.app");
  });

  it("no promete comisiones ni cifras de terceros", () => {
    for (const f of faq) expect(`${f.q} ${f.a}`).not.toMatch(/\d+ ?%/);
  });
});

describe("muestrario de presets", () => {
  const specimens = presetSpecimens();

  it("tiene un renglón por rubro (sin «otro») con su preset real", () => {
    expect(specimens.map((s) => s.kind)).toEqual(STORE_KINDS.filter((k) => k.id !== "otro").map((k) => k.id));
    for (const s of specimens) {
      expect(s.theme).toBe(PRESETS[s.presetId]);
      expect(SPECIMEN_PRODUCTS[s.kind].compareAt).toBeGreaterThan(SPECIMEN_PRODUCTS[s.kind].price);
    }
  });

  it("calcula desde qué plan se puede usar cada preset", () => {
    expect(presetMinPlan(plans, "nordico")?.code).toBe("free");
    expect(presetMinPlan(plans, "mercado")?.code).toBe("free");
    expect(presetMinPlan(plans, "bodega")?.code).toBe("starter");
    expect(presetMinPlan([], "bodega")).toBeNull();
  });

  it("recorta las fuentes a los glifos usados, con mayúsculas", () => {
    expect(glyphSubset(["ab", "ba"])).toBe("ABab");
    const href = specimenFontsHref([PRESETS.atelier], ["Moda"]);
    expect(href).toContain("family=Cormorant+Garamond:wght@500");
    expect(href).toContain("family=Jost:wght@400;600");
    expect(href).toContain(`&text=${encodeURIComponent("ADMOado")}`);
  });
});

describe("plan-notes", () => {
  it("dice desde qué plan está cada función", async () => {
    const { availability, minPlanName } = await import("./plan-notes");
    expect(availability(plans, "catalog.variants")).toBe("todos los planes");
    expect(availability(plans, "catalog.import_csv")).toBe("desde Starter");
    expect(availability(plans, "catalog.import_web")).toBe("desde Pro");
    expect(minPlanName(plans, "domain.custom")).toBe("Pro");
    // Sin planes cargados usa los defaults del código.
    expect(availability([], "pricing.bulk")).toBe("desde Pro");
  });
});
