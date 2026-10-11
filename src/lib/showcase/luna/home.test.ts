import { describe, expect, it } from "vitest";

import { blockSchema, blocksSchema } from "@/lib/blocks/schema";

import { LUNA_CATEGORY_ORDER, lunaHomeBlocks, moonPhase, nextNewMoon } from "./home";
import { LUNA_ANNOUNCEMENT, LUNA_MENUS, lunaCategoryImage } from "./index";

const DAY = 86_400_000;
const NOW = new Date("2026-10-11T15:00:00Z");

describe("nextNewMoon", () => {
  // Lunas nuevas reales de 2026 (UTC).
  const REAL = ["2026-01-18T19:52Z", "2026-08-12T17:37Z", "2026-10-10T15:50Z", "2026-11-09T07:02Z", "2026-12-09T00:52Z"];

  it.each(REAL)("acierta la luna nueva del %s (± 1 día)", (iso) => {
    const real = Date.parse(iso);
    // Desde 5 días antes, la próxima es esa.
    const got = nextNewMoon(new Date(real - 5 * DAY)).getTime();
    expect(Math.abs(got - real)).toBeLessThan(DAY);
  });

  it("es precisa al minuto con los términos de Meeus", () => {
    const got = nextNewMoon(new Date("2026-11-01T00:00:00Z")).getTime();
    expect(Math.abs(got - Date.parse("2026-11-09T07:02Z"))).toBeLessThan(10 * 60_000);
  });

  it("siempre devuelve una fecha futura, a menos de un mes sinódico", () => {
    for (let t = Date.parse("2026-01-01T00:00Z"); t < Date.parse("2027-01-01T00:00Z"); t += 0.37 * DAY) {
      const now = new Date(t);
      const diff = nextNewMoon(now).getTime() - t;
      expect(diff).toBeGreaterThan(0);
      expect(diff).toBeLessThanOrEqual(29.9 * DAY);
    }
  });

  it("justo después de una luna nueva, salta a la siguiente", () => {
    const got = nextNewMoon(new Date("2026-10-10T16:00Z"));
    expect(Math.abs(got.getTime() - Date.parse("2026-11-09T07:02Z"))).toBeLessThan(DAY);
  });
});

describe("moonPhase", () => {
  it("nombra las cuatro fases", () => {
    expect(moonPhase(new Date("2026-10-10T20:00Z"))).toBe("nueva");
    expect(moonPhase(new Date("2026-10-17T12:00Z"))).toBe("creciente");
    expect(moonPhase(new Date("2026-10-26T04:00Z"))).toBe("llena"); // llena real: 26/10 04:12 UTC
    expect(moonPhase(new Date("2026-11-02T12:00Z"))).toBe("menguante");
  });
});

describe("lunaHomeBlocks", () => {
  const blocks = lunaHomeBlocks({ now: NOW, transferDiscount: 10, whatsapp: true, freeShippingFrom: 120_000 });

  it("arma una portada editorial de al menos 12 bloques con ids únicos y estables", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(12);
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("luna-"))).toBe(true);
    expect(lunaHomeBlocks({ now: NOW, transferDiscount: 10, whatsapp: true }).map((b) => b.id)).toEqual(ids);
  });

  it("todos los bloques validan con el schema del constructor (y no cambian al parsear)", () => {
    for (const b of blocks) {
      const r = blockSchema.safeParse(b);
      expect(r.success, `${b.id}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true);
      if (r.success) expect(r.data).toEqual(b);
    }
    expect(blocksSchema.safeParse(blocks).success).toBe(true);
  });

  it("usa casi todo el repertorio y alterna bandas noche", () => {
    const types = new Set(blocks.map((b) => b.type));
    for (const t of ["marquee", "hero", "category_list", "product_grid", "lookbook", "countdown", "image_text", "product_slider", "banner_grid", "testimonials", "features", "faq"] as const) {
      expect(types.has(t), t).toBe(true);
    }
    expect(blocks.filter((b) => b.style.background === "primary").length).toBeGreaterThanOrEqual(3);
    expect(blocks.some((b) => b.style.background === "surface")).toBe(true);
  });

  it("sin categoryIds no necesita ningún UUID (vista previa)", () => {
    const json = JSON.stringify(blocks);
    expect(json).not.toMatch(/"kind":"(manual|category)"/);
    const cats = blocks.find((b) => b.type === "category_list");
    expect(cats?.type === "category_list" && cats.settings.categoryIds).toBe("all");
  });

  it("con categoryIds, «Elegí por prenda» las muestra en el orden de la marca", () => {
    const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    const ids = Object.fromEntries(LUNA_CATEGORY_ORDER.map((slug, i) => [slug, uuid(i)]));
    const withIds = lunaHomeBlocks({ now: NOW, transferDiscount: 10, whatsapp: true, categoryIds: ids });
    const cats = withIds.find((b) => b.type === "category_list");
    expect(cats?.type === "category_list" && cats.settings.categoryIds).toEqual(LUNA_CATEGORY_ORDER.map((_, i) => uuid(i)));
    expect(blocksSchema.safeParse(withIds).success).toBe(true);
  });

  it("la cuenta regresiva apunta a la próxima luna nueva y tiene texto de cierre", () => {
    const cd = blocks.find((b) => b.type === "countdown");
    if (cd?.type !== "countdown") throw new Error("falta el countdown");
    expect(cd.settings.endsAt).toBe(nextNewMoon(NOW).toISOString());
    expect(Math.abs(Date.parse(cd.settings.endsAt) - Date.parse("2026-11-09T07:02Z"))).toBeLessThan(DAY);
    expect(cd.settings.expiredText).toBeTruthy();
  });

  it("el copy depende de la tienda: sin descuento ni envío gratis no los promete", () => {
    const plain = JSON.stringify(lunaHomeBlocks({ now: NOW, transferDiscount: 0, whatsapp: false }));
    expect(plain).not.toMatch(/off pagando|120\.000|WhatsApp/);
    const full = JSON.stringify(blocks);
    expect(full).toMatch(/10 % off pagando por transferencia/);
    expect(full).toMatch(/\$ 120\.000/);
    expect(full).toMatch(/luna nueva del lunes 9\/11/);
  });

  it("el FAQ es el ancla del menú «Cómo comprar»", () => {
    const faq = blocks.find((b) => b.type === "faq");
    expect(faq?.type === "faq" && faq.settings.title).toBe("Cómo comprar");
    expect(LUNA_MENUS.header.some((i) => i.href === "/#como-comprar")).toBe(true);
  });
});

describe("assets y marca", () => {
  it("rutas de categoría relativas o absolutas", () => {
    expect(lunaCategoryImage("remeras")).toBe("/demo/luna/cat-remeras.svg");
    expect(lunaCategoryImage("buzos-y-camperas", "https://demo.ecommy.app/")).toBe("https://demo.ecommy.app/demo/luna/cat-buzos-y-camperas.svg");
  });

  it("el anuncio entra en el límite del panel (140)", () => {
    expect(LUNA_ANNOUNCEMENT.text.length).toBeLessThanOrEqual(140);
  });
});
