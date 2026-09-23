import { describe, expect, it } from "vitest";

import { HELP_ARTICLES, helpBySection, relatedHelp } from "./ayuda";
import { GUIDES } from "./guias";
import { normalizeSearch, searchHelp } from "./search";
import { extractHeadings, extractLinks, plainText, readingMinutesFor, wordCount } from "./text";
import { HELP_SECTIONS, type Guide, type HelpArticle } from "./types";

/*
 * Controles del contenido editorial (/ayuda y /guias): metadatos completos,
 * largos, índice, links internos y nada de relleno ni emojis.
 */

const ALL: (HelpArticle | Guide)[] = [...HELP_ARTICLES, ...GUIDES];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMOJI = /\p{Extended_Pictographic}/u;
const words = (a: HelpArticle | Guide) => wordCount(plainText(a.body));

describe("metadatos de los artículos", () => {
  it("hay al menos 12 artículos de ayuda y 4 guías", () => {
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(12);
    expect(GUIDES.length).toBeGreaterThanOrEqual(4);
  });

  it.each(ALL.map((a) => [a.slug, a] as const))("%s tiene título, descripción, fecha y sección", (_slug, a) => {
    expect(a.slug).toMatch(SLUG);
    expect(a.title.trim().length).toBeGreaterThan(10);
    expect(a.description.trim().length).toBeGreaterThan(60);
    expect(a.description.length).toBeLessThanOrEqual(160);
    expect(a.publishedAt).toMatch(ISO_DATE);
    expect(a.updatedAt).toMatch(ISO_DATE);
    expect(a.updatedAt >= a.publishedAt).toBe(true);
    expect(a.section.trim()).not.toBe("");
    expect(a.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("los slugs son únicos (dentro de cada colección y entre las dos)", () => {
    const help = HELP_ARTICLES.map((a) => a.slug);
    const guides = GUIDES.map((g) => g.slug);
    expect(new Set(help).size).toBe(help.length);
    expect(new Set(guides).size).toBe(guides.length);
    expect(new Set([...help, ...guides]).size).toBe(help.length + guides.length);
  });

  it("los títulos son únicos", () => {
    const titles = ALL.map((a) => a.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("cada artículo de ayuda está en una sección que existe", () => {
    const ids = new Set<string>(HELP_SECTIONS.map((s) => s.id));
    for (const a of HELP_ARTICLES) expect(ids.has(a.section), a.slug).toBe(true);
  });

  it("las guías tienen un CTA con título y texto", () => {
    for (const g of GUIDES) {
      expect(g.cta.title.trim(), g.slug).not.toBe("");
      expect(g.cta.text.length, g.slug).toBeLessThanOrEqual(200);
    }
  });
});

describe("cuerpo de los artículos", () => {
  it.each(HELP_ARTICLES.map((a) => [a.slug, a] as const))("ayuda «%s» tiene entre 300 y 700 palabras", (_slug, a) => {
    const n = words(a);
    expect(n).toBeGreaterThanOrEqual(300);
    expect(n).toBeLessThanOrEqual(700);
  });

  it.each(GUIDES.map((g) => [g.slug, g] as const))("guía «%s» tiene entre 900 y 1.400 palabras", (_slug, g) => {
    const n = words(g);
    expect(n).toBeGreaterThanOrEqual(900);
    expect(n).toBeLessThanOrEqual(1400);
  });

  it.each(ALL.map((a) => [a.slug, a] as const))("«%s» declara bien los minutos de lectura", (_slug, a) => {
    expect(Math.abs(a.readingMinutes - readingMinutesFor(words(a)))).toBeLessThanOrEqual(1);
  });

  it.each(ALL.map((a) => [a.slug, a] as const))("«%s» tiene h2 con id únicos para el índice", (_slug, a) => {
    const headings = extractHeadings(a.body);
    expect(headings.length).toBeGreaterThanOrEqual(3);
    for (const h of headings) {
      expect(h.id).toMatch(SLUG);
      expect(h.text).not.toBe("");
    }
    expect(new Set(headings.map((h) => h.id)).size).toBe(headings.length);
  });

  it.each(ALL.map((a) => [a.slug, a] as const))("«%s» no tiene emojis, lorem ni marcas de borrador", (_slug, a) => {
    const text = [a.title, a.description, plainText(a.body), "cta" in a ? `${a.cta.title} ${a.cta.text}` : ""].join(" ");
    expect(text).not.toMatch(EMOJI);
    expect(text).not.toMatch(/lorem|ipsum/i);
    expect(text).not.toMatch(/\b(TODO|TBD|FIXME|VERIFICAR|XXX)\b/);
    expect(text).not.toMatch(/!\s*!|¡[^!]*!\s*¡/);
  });

  it("cada guía menciona Ecommy una sola vez en el cuerpo", () => {
    for (const g of GUIDES) expect(plainText(g.body).match(/Ecommy/g)?.length ?? 0, g.slug).toBe(1);
  });

  it("los artículos legales avisan que son orientativos", () => {
    const legal = [...HELP_ARTICLES.filter((a) => a.section === "legales"), ...GUIDES.filter((g) => g.section === "Legales" || g.section === "Impuestos")];
    expect(legal.length).toBeGreaterThan(0);
    for (const a of legal) expect(plainText(a.body), a.slug).toMatch(/orientativ/i);
  });

  it("los links internos a /ayuda y /guias apuntan a artículos que existen", () => {
    const help = new Set(HELP_ARTICLES.map((a) => a.slug));
    const guides = new Set(GUIDES.map((g) => g.slug));
    for (const a of ALL) {
      for (const href of extractLinks(a.body)) {
        const m = /^\/(ayuda|guias)\/([^#?/]+)/.exec(href);
        if (!m) continue;
        expect((m[1] === "ayuda" ? help : guides).has(m[2]), `${a.slug} → ${href}`).toBe(true);
      }
    }
  });

  it("los `related` de la ayuda existen y no se apuntan a sí mismos", () => {
    const help = new Set(HELP_ARTICLES.map((a) => a.slug));
    for (const a of HELP_ARTICLES) {
      for (const r of a.related ?? []) {
        expect(help.has(r), `${a.slug} → ${r}`).toBe(true);
        expect(r).not.toBe(a.slug);
      }
    }
  });

  it("los links del panel apuntan al admin", () => {
    for (const a of HELP_ARTICLES) if (a.panel) expect(a.panel.href, a.slug).toMatch(/^\/admin(\/|$)/);
  });
});

describe("índice y relacionados", () => {
  it("agrupa por sección en el orden definido, sin secciones vacías", () => {
    const sections = helpBySection();
    const order = HELP_SECTIONS.map((s) => s.id);
    expect(sections.map((s) => order.indexOf(s.id))).toEqual([...sections.map((s) => order.indexOf(s.id))].sort((a, b) => a - b));
    expect(sections.every((s) => s.articles.length > 0)).toBe(true);
    expect(sections.reduce((n, s) => n + s.articles.length, 0)).toBe(HELP_ARTICLES.length);
  });

  it("relacionados: primero la misma sección, sin repetir ni incluirse", () => {
    for (const a of HELP_ARTICLES) {
      const rel = relatedHelp(a);
      expect(rel.length).toBeLessThanOrEqual(3);
      expect(rel.some((r) => r.slug === a.slug)).toBe(false);
      expect(new Set(rel.map((r) => r.slug)).size).toBe(rel.length);
      const same = HELP_ARTICLES.filter((x) => x.section === a.section && x.slug !== a.slug);
      if (same.length) expect(rel[0].section).toBe(a.section);
    }
  });
});

describe("búsqueda de la ayuda", () => {
  const items = [
    { title: "Zonas de envío", description: "Dibujá en el mapa hasta dónde llegás." },
    { title: "Importar desde una planilla CSV", description: "Actualizá precios por SKU." },
    { title: "Cómo cobrás", description: "Transferencia con descuento y envío." },
  ];

  it("normaliza tildes, mayúsculas y signos", () => {
    expect(normalizeSearch("  ¿Envíos a CÓRDOBA?  ")).toBe("envios a cordoba");
  });

  it("vacío no devuelve nada", () => {
    expect(searchHelp(items, "   ")).toEqual([]);
  });

  it("busca en título y descripción, sin tildes, con todas las palabras", () => {
    expect(searchHelp(items, "csv").map((i) => i.title)).toEqual(["Importar desde una planilla CSV"]);
    expect(searchHelp(items, "precios sku")).toHaveLength(1);
    expect(searchHelp(items, "precios mapa")).toHaveLength(0);
    expect(searchHelp(items, "cobras")).toHaveLength(1);
  });

  it("los que coinciden en el título van primero", () => {
    expect(searchHelp(items, "envio").map((i) => i.title)).toEqual(["Zonas de envío", "Cómo cobrás"]);
  });

  it("encuentra los artículos reales por palabras típicas", () => {
    expect(searchHelp(HELP_ARTICLES, "csv").length).toBeGreaterThan(0);
    expect(searchHelp(HELP_ARTICLES, "arrepentimiento").length).toBeGreaterThan(0);
    expect(searchHelp(HELP_ARTICLES, "transferencia").length).toBeGreaterThan(0);
  });
});
