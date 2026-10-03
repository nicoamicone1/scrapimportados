import { describe, expect, it } from "vitest";

import { parseTheme } from "./css";
import { PRESETS } from "./presets";
import { DEFAULT_THEME_STYLE } from "./schema";

/** `parseTheme` y `theme.style` (DESIGN.md §3.9): temas guardados antes de 2026-10 siguen siendo su preset. */
describe("parseTheme · theme.style", () => {
  it("un tema guardado sin `style` toma el estilo de su preset, no el genérico", () => {
    const { style: _drop, ...saved } = PRESETS.atelier;
    void _drop;
    expect(parseTheme(saved).style).toEqual(PRESETS.atelier.style);
  });

  it("un `style` parcial (los cinco campos de la base) se completa con los del preset", () => {
    const saved = { ...PRESETS.galpon, style: { hero: "split", titles: "rule", shape: "rect", card: "row", motion: "none" } };
    const t = parseTheme(saved);
    expect(t.style.grid).toBe("list");
    expect(t.style.gallery).toBe(PRESETS.galpon.style.gallery);
  });

  it("lo que el dueño eligió en `style` se respeta", () => {
    const saved = { ...PRESETS.bodega, style: { ...PRESETS.bodega.style, card: "tile" } };
    expect(parseTheme(saved).style.card).toBe("tile");
  });

  it("`{ preset }` solo (lo que guarda create_store) es el preset completo", () => {
    expect(parseTheme({ preset: "recreo" })).toEqual(PRESETS.recreo);
  });

  it("un tema personalizado sin `style` usa el default", () => {
    const { style: _drop, ...saved } = { ...PRESETS.nordico, preset: "custom" as const };
    void _drop;
    expect(parseTheme(saved).style).toEqual(DEFAULT_THEME_STYLE);
  });

  it("los layouts nuevos de header y pie validan", () => {
    const t = parseTheme({ ...PRESETS.nordico, header: { ...PRESETS.nordico.header, layout: "pill" }, footer: { ...PRESETS.nordico.footer, style: "band" } });
    expect(t.header.layout).toBe("pill");
    expect(t.footer.style).toBe("band");
  });
});
