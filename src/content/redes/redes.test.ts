import { ImageResponse } from "next/og";
import { describe, expect, it } from "vitest";

import { SOCIAL_TONES, loadSocialFonts, renderRedSlide } from "@/app/_brand/social-templates";
import { BRAND_AMBER, BRAND_CREAM, BRAND_INK, BRAND_MUTED } from "@/app/_brand/glyph";

import {
  FORMAT_SIZE,
  HASHTAGS,
  RED_FORMATS,
  RED_PIECES,
  captionFor,
  cleanFillValue,
  fillSlide,
  fillText,
  fillValuesFrom,
  getRedPiece,
  pendingTokens,
  redFileName,
  redImageHref,
  slideTexts,
  type FillValues,
  type RedPiece,
} from ".";

/*
 * Controles del kit de redes (/platform/redes): códigos del kit, formatos,
 * copy (sin emojis ni relleno, gancho corto), campos "completar" declarados
 * y usados, contraste de las plantillas y que Satori dibuje cada placa.
 */

const EMOJI = /\p{Extended_Pictographic}/u;
const FORBIDDEN = /\b(potenci[aá]|revolucion[aá]|ecosistema|soluci[oó]n|disruptiv[oa]|siguiente nivel)\b/i;
const RESERVED_PARAMS = new Set(["format", "placa", "download", "formato"]);

function allTexts(p: RedPiece): string[] {
  return [p.name, p.hook, p.caption ?? "", p.cta ?? "", p.check ?? "", ...p.hashtags, ...p.slides.flatMap(slideTexts)];
}

function exampleValues(p: RedPiece): FillValues {
  return Object.fromEntries((p.fields ?? []).map((f) => [f.key, f.example ?? "x"]));
}

describe("piezas del kit", () => {
  it("están los 15 posts (P01…P15) y las 10 historias (H01…H10), sin repetir", () => {
    const ids = RED_PIECES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const expected = [
      ...Array.from({ length: 15 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 10 }, (_, i) => `H${String(i + 1).padStart(2, "0")}`),
    ];
    expect(ids).toEqual(expected);
  });

  it.each(RED_PIECES.map((p) => [p.id, p] as const))("%s: formatos, canales y placas válidos", (_id, p) => {
    expect(p.formats.length).toBeGreaterThan(0);
    for (const f of p.formats) expect(RED_FORMATS).toContain(f);
    expect(new Set(p.formats).size).toBe(p.formats.length);
    expect(p.channels.length).toBeGreaterThan(0);
    expect(p.slides.length).toBeGreaterThan(0);
    expect(p.slides.length).toBeLessThanOrEqual(11); // Instagram: hasta 20 por carrusel; el kit usa 11 como mucho.
    if (p.kind === "historias") {
      expect(p.formats).toEqual(["story"]);
      expect(p.slides.length).toBeGreaterThanOrEqual(2);
      expect(p.slides.length).toBeLessThanOrEqual(5);
    }
    // La plantilla "historia" es vertical: sólo en piezas que no salen en feed.
    if (p.slides.some((s) => s.template === "historia")) expect(p.formats).toEqual(["story"]);
    for (const d of p.days) expect(d >= 1 && d <= 30).toBe(true);
  });

  it.each(RED_PIECES.map((p) => [p.id, p] as const))("%s: listas y comparaciones con 2 a 4 ítems", (_id, p) => {
    for (const s of p.slides) {
      if (s.template === "lista") {
        expect(s.items.length).toBeGreaterThanOrEqual(2);
        expect(s.items.length).toBeLessThanOrEqual(4);
      }
      if (s.template === "antes-despues") {
        expect(s.before.items.length).toBe(s.after.items.length);
        expect(s.before.items.length).toBeGreaterThanOrEqual(2);
        expect(s.before.items.length).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("copy", () => {
  it.each(RED_PIECES.map((p) => [p.id, p] as const))("%s: gancho de 90 caracteres o menos, sin emojis ni relleno", (_id, p) => {
    expect(p.hook.trim().length).toBeGreaterThan(8);
    expect(p.hook.length).toBeLessThanOrEqual(90);
    for (const t of allTexts(p)) {
      expect(t, t).not.toMatch(EMOJI);
      expect(t, t).not.toMatch(FORBIDDEN);
      expect(t, t).not.toMatch(/!{2,}|\?{2,}/);
    }
    // Un signo de exclamación como mucho por pieza (SOCIAL-KIT §0).
    expect(allTexts(p).join(" ").split("!").length - 1).toBeLessThanOrEqual(1);
  });

  it("posts con 3 a 5 hashtags, siempre los tres de la marca; historias sin hashtags", () => {
    for (const p of RED_PIECES) {
      if (p.kind === "historias") {
        expect(p.hashtags).toEqual([]);
        expect(p.caption).toBeUndefined();
        continue;
      }
      expect(p.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(p.hashtags.length).toBeLessThanOrEqual(5);
      for (const h of HASHTAGS) expect(p.hashtags).toContain(h);
      for (const h of p.hashtags) expect(h).toMatch(/^#[a-z]+$/);
      expect(p.caption?.trim()).toBeTruthy();
      expect(p.cta?.trim()).toBeTruthy();
    }
  });

  it("el texto para copiar lleva gancho, texto, CTA y hashtags; el de historias, cada pantalla numerada", () => {
    const p01 = getRedPiece("p01")!;
    const text = captionFor(p01, { tiempo: "18 minutos" });
    expect(text.startsWith(p01.hook)).toBe(true);
    expect(text).toContain("listo para compartir: 18 minutos.");
    expect(text).toContain(p01.cta!);
    expect(text.endsWith(p01.hashtags.join(" "))).toBe(true);

    const h02 = getRedPiece("H02")!;
    const story = captionFor(h02);
    expect(story).toContain("1) Cómo funciona · 1 de 4 · Creás la tienda y elegís el rubro.");
    expect(story).toContain("4) ");
  });
});

describe("piezas para completar", () => {
  it.each(RED_PIECES.map((p) => [p.id, p] as const))("%s: cada […] está declarado en `fields` y cada campo se usa", (_id, p) => {
    const tokens = pendingTokens(allTexts(p));
    const declared = (p.fields ?? []).map((f) => f.token);
    expect(tokens.sort()).toEqual([...declared].sort());
    const keys = (p.fields ?? []).map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of p.fields ?? []) {
      expect(f.key).toMatch(/^[a-z]+$/);
      expect(RESERVED_PARAMS.has(f.key)).toBe(false);
      expect(f.token).toMatch(/^\[[^\]]+\]$/);
      expect(f.label.trim()).toBeTruthy();
      // El dato va en la imagen o en el copy, no sólo en la lista de campos.
      expect(p.slides.flatMap(slideTexts).some((t) => t.includes(f.token)) || p.hook.includes(f.token)).toBe(true);
    }
  });

  it("las piezas que dependen de una grabación real están marcadas (P01, P05, P14)", () => {
    for (const id of ["P01", "P05", "P14"]) {
      const p = getRedPiece(id)!;
      expect(p.fields?.length, id).toBeGreaterThan(0);
      expect(p.check, id).toMatch(/grabación/);
    }
    expect(getRedPiece("P01")!.slides.some((s) => slideTexts(s).some((t) => t.includes("[tiempo real]")))).toBe(true);
  });

  it("con los valores completos no queda ningún […] en las placas ni en el copy", () => {
    for (const p of RED_PIECES) {
      const values = exampleValues(p);
      const texts = [...p.slides.flatMap((s) => slideTexts(fillSlide(p, s, values))), fillText(p, p.hook, values), captionFor(p, values)];
      expect(pendingTokens(texts), p.id).toEqual([]);
    }
  });

  it("los valores de la URL se limpian y sólo cuentan los campos declarados", () => {
    expect(cleanFillValue("  18\nminutos\u0000 ")).toBe("18 minutos");
    expect(cleanFillValue("x".repeat(200))).toHaveLength(60);
    const p05 = getRedPiece("P05")!;
    const params = new URLSearchParams({ cantidad: "300", segundos: " ", otro: "no" });
    expect(fillValuesFrom(p05, (k) => params.get(k))).toEqual({ cantidad: "300" });
  });

  it("URLs y nombres de archivo", () => {
    const p03 = getRedPiece("P03")!;
    expect(redImageHref(p03, { format: "feed", slide: 1 })).toBe("/platform/redes/p03/image?format=feed");
    expect(redImageHref(p03, { format: "story", slide: 2, download: true })).toBe("/platform/redes/p03/image?format=story&placa=2&download=1");
    expect(redFileName(p03, 2, "feed")).toBe("ecommy-p03-2-feed.png");
    expect(redFileName(getRedPiece("P01")!, 1, "story")).toBe("ecommy-p01-1-story.png");
    expect(getRedPiece("P99")).toBeUndefined();
  });
});

/** Contraste WCAG entre dos colores #rrggbb. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("plantillas", () => {
  it("texto, acento y texto secundario pasan AA (4.5:1) sobre crema y sobre verde-tinta", () => {
    for (const tone of Object.values(SOCIAL_TONES)) {
      expect(contrast(tone.fg, tone.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tone.accent, tone.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tone.muted, tone.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(BRAND_INK, BRAND_AMBER)).toBeGreaterThanOrEqual(4.5); // CTA y banda "Completar"
    expect(contrast(BRAND_MUTED, BRAND_CREAM)).toBeGreaterThanOrEqual(4.5); // leyenda de la captura
  });

  it("Satori dibuja todas las placas en todos sus formatos (PNG del tamaño pedido)", { timeout: 60_000 }, async () => {
    const fonts = await loadSocialFonts();
    expect(fonts?.length).toBe(1);
    for (const p of RED_PIECES) {
      for (const format of p.formats) {
        for (let i = 0; i < p.slides.length; i++) {
          const slide = fillSlide(p, p.slides[i], {});
          const el = renderRedSlide(slide, {
            format,
            index: i + 1,
            total: p.kind === "carrusel" ? p.slides.length : 1,
            pending: pendingTokens(slideTexts(slide)),
          });
          const png = new Uint8Array(await new ImageResponse(el, { ...FORMAT_SIZE[format], fonts }).arrayBuffer());
          expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join(""), `${p.id} ${i + 1} ${format}`).toBe("PNG");
          const view = new DataView(png.buffer, png.byteOffset);
          expect([view.getUint32(16), view.getUint32(20)]).toEqual([FORMAT_SIZE[format].width, FORMAT_SIZE[format].height]);
        }
      }
    }
  });
});
