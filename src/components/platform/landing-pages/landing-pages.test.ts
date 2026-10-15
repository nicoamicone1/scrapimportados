import { describe, expect, it } from "vitest";

import { PLAN_CODES, PLAN_DEFAULTS, PLAN_NAMES } from "@/lib/plans";

import {
  CATALOG_COMPARE,
  compareGroups,
  freeProducts,
  LANDING_PAGES,
  SOURCES,
  tiendanubeFaq,
  TRANSFER_FLOW,
  transferFaq,
  VERIFIED_AT,
  WHATSAPP_FLOW,
  WHATSAPP_NOT,
  whatsappFaq,
  whenToChoose,
} from "./content";
import { sourceOrder } from "./CompareTable";
import { breadcrumbJsonLd, faqJsonLd } from "./jsonld";
import { landingMetadata } from "./metadata";

/* Planes como los devuelve `listPublicPlans` con el seed. */
const seeded = PLAN_CODES.map((code) => ({
  code,
  name: PLAN_NAMES[code],
  features: PLAN_DEFAULTS[code].features,
  limits: PLAN_DEFAULTS[code].limits,
  priceMonthly: PLAN_DEFAULTS[code].price,
}));

/** BRAND §3.1: palabras prohibidas en todo texto público. */
const FORBIDDEN = /\b(soluci[oó]n|ecosistema|potenci[aá]|revolucion[aá]|disruptiv[oa]|siguiente nivel|experiencia única|increíble|mágico|f[aá]cil(es)?|todo en uno)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Todo el copy de las tres páginas, con planes del seed y sin planes. */
function allCopy(): string[] {
  const texts: string[] = [];
  for (const plans of [seeded, []]) {
    for (const g of compareGroups(plans)) {
      texts.push(g.title);
      for (const r of g.rows) texts.push(r.topic, r.ecommy, r.tiendanube);
    }
    const choose = whenToChoose(plans);
    for (const i of [...choose.tiendanube, ...choose.ecommy]) texts.push(i.title, i.text);
    for (const f of [...tiendanubeFaq(plans), ...whatsappFaq(plans), ...transferFaq()]) texts.push(f.q, f.a);
  }
  for (const s of [...WHATSAPP_FLOW, ...TRANSFER_FLOW, ...WHATSAPP_NOT]) texts.push(s.title, s.text);
  for (const r of CATALOG_COMPARE) texts.push(r.topic, r.catalog, r.ecommy);
  for (const p of LANDING_PAGES) texts.push(p.title, p.description, p.og.title, p.og.line, p.og.eyebrow);
  return texts;
}

describe("páginas de captación · metadata", () => {
  it("títulos de hasta 60 caracteres y descripciones de hasta 155, únicos", () => {
    for (const p of LANDING_PAGES) {
      expect(p.title.length, p.title).toBeLessThanOrEqual(60);
      expect(p.description.length, p.description).toBeLessThanOrEqual(155);
      expect(p.description.length, p.description).toBeGreaterThan(70);
    }
    expect(new Set(LANDING_PAGES.map((p) => p.title)).size).toBe(LANDING_PAGES.length);
    expect(new Set(LANDING_PAGES.map((p) => p.path)).size).toBe(LANDING_PAGES.length);
  });

  it("cada título lleva la búsqueda que ataca", () => {
    const [tn, wa, transfer] = LANDING_PAGES;
    expect(tn.title.toLowerCase()).toContain("alternativa a tiendanube");
    expect(wa.title.toLowerCase()).toContain("pedidos por whatsapp");
    expect(transfer.title.toLowerCase()).toContain("pago por transferencia");
  });

  it("canonical y OpenGraph apuntan a la ruta, con el título completo", () => {
    for (const p of LANDING_PAGES) {
      const m = landingMetadata(p);
      expect(m.alternates?.canonical).toBe(p.path);
      expect(m.title).toEqual({ absolute: p.title });
      expect(m.openGraph).toMatchObject({ url: p.path, title: p.title, description: p.description, locale: "es_AR" });
    }
  });

  it("el título de la imagen para compartir contiene su resaltado", () => {
    for (const p of LANDING_PAGES) if (p.og.highlight) expect(p.og.title).toContain(p.og.highlight);
  });
});

describe("páginas de captación · copy", () => {
  it("sin palabras prohibidas, emojis ni exclamaciones", () => {
    for (const t of allCopy()) {
      expect(t, t).not.toMatch(FORBIDDEN);
      expect(t, t).not.toMatch(EMOJI);
      expect(t, t).not.toContain("!");
    }
  });

  it("no escribe precios de Ecommy en pesos (van por /planes o por la base)", () => {
    for (const t of allCopy()) expect(t, t).not.toMatch(/\$ ?\d{1,3}\.\d{3}/);
  });

  it("las preguntas no repiten id ni pregunta, y no citan cifras de terceros", () => {
    for (const faq of [tiendanubeFaq(seeded), whatsappFaq(seeded), transferFaq()]) {
      expect(new Set(faq.map((f) => f.id)).size).toBe(faq.length);
      expect(new Set(faq.map((f) => f.q)).size).toBe(faq.length);
      expect(faq.length).toBeGreaterThanOrEqual(4);
      expect(faq.length).toBeLessThanOrEqual(6);
      // Sin porcentajes: lo que se muestra en Google sin la fecha de verificación no puede envejecer.
      for (const f of faq) expect(`${f.q} ${f.a}`, f.q).not.toMatch(/\d+ ?%/);
    }
  });

  it("los «desde qué plan» salen de los planes (y sin planes, de los defaults)", () => {
    const rows = compareGroups(seeded).flatMap((g) => g.rows);
    expect(rows.find((r) => r.topic === "Consultas por WhatsApp")?.ecommy).toContain("Desde Starter.");
    expect(rows.find((r) => r.topic === "Plan gratis")?.ecommy).toContain(`hasta ${PLAN_DEFAULTS.free.limits.products} productos`);
    expect(compareGroups([])).toEqual(compareGroups(seeded));
    expect(whatsappFaq(seeded)[0].a).toContain("desde Starter");

    // Si Responder baja a Free, la página lo dice sola.
    const moved = seeded.map((p) => ({ ...p, features: { ...p.features, "orders.replies": true } }));
    expect(whatsappFaq(moved)[0].a).toContain("en todos los planes");
    expect(freeProducts([{ ...seeded[0], limits: { ...seeded[0].limits, products: 40 } }])).toBe(40);
  });

  it("el importador desde Tiendanube no se promete: se dice que no está probado", () => {
    const faq = tiendanubeFaq(seeded).find((f) => f.id === "importar");
    expect(faq?.a).toMatch(/todavía no lo probamos/);
    expect(faq?.a).toMatch(/lo cargamos nosotros/);
  });
});

describe("páginas de captación · datos de terceros", () => {
  it("la fecha de verificación es ISO y cada fila cita al menos una fuente oficial", () => {
    expect(VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const g of compareGroups(seeded)) {
      for (const r of g.rows) {
        expect(r.sources.length, r.topic).toBeGreaterThan(0);
        for (const s of r.sources) expect(SOURCES[s], s).toBeDefined();
      }
    }
  });

  it("las fuentes son páginas oficiales con https", () => {
    for (const s of Object.values(SOURCES)) {
      const host = new URL(s.url).hostname;
      expect(s.url.startsWith("https://"), s.url).toBe(true);
      expect(/(^|\.)tiendanube\.com$|(^|\.)whatsappbusiness\.com$/.test(host), host).toBe(true);
    }
  });

  it("la tabla dice lo que Tiendanube tiene y Ecommy no, y marca la paridad", () => {
    const groups = compareGroups(seeded);
    const verdicts = groups.flatMap((g) => g.rows.map((r) => r.verdict));
    expect(verdicts).toContain("paridad");
    expect(verdicts.filter((v) => v === "tiendanube").length).toBeGreaterThanOrEqual(3);
    const topics = groups.flatMap((g) => g.rows.map((r) => r.topic));
    expect(topics).toEqual(expect.arrayContaining(["Correos y etiquetas", "Mercado Libre", "Apps de terceros", "Botón de arrepentimiento"]));
  });

  it("numera las fuentes en el orden en que aparecen, sin repetir", () => {
    const order = sourceOrder(compareGroups(seeded));
    expect(order[0]).toBe("tn-costos");
    expect(new Set(order).size).toBe(order.length);
  });
});

describe("páginas de captación · datos estructurados", () => {
  it("BreadcrumbList con posiciones y URLs absolutas", () => {
    const ld = breadcrumbJsonLd("https://ecommy.app", [
      { label: "Inicio", href: "/" },
      { label: "Pedidos por WhatsApp", href: "/funciones/pedidos-por-whatsapp" },
    ]);
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://ecommy.app/" },
      { "@type": "ListItem", position: 2, name: "Pedidos por WhatsApp", item: "https://ecommy.app/funciones/pedidos-por-whatsapp" },
    ]);
  });

  it("FAQPage con las mismas preguntas que el acordeón", () => {
    const faq = transferFaq();
    const ld = faqJsonLd("https://ecommy.app", "/funciones/cobrar-por-transferencia", faq);
    expect(ld.mainEntity.map((q) => q.name)).toEqual(faq.map((f) => f.q));
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe(faq[0].a);
  });
});
