import { formatMoney } from "@/lib/money";
import type { PlanInfo } from "@/lib/plans";
import { isPresetAllowed } from "@/lib/schemas/appearance";
import { STORE_KINDS, type StoreKind } from "@/lib/tenant/kinds";
import { googleHref, PRESET_LIST, PRESETS, type Theme } from "@/lib/theme";

/*
 * Muestrario de estilos de la landing ("Para quién"): un renglón por rubro
 * del alta de tienda, con el preset que ese rubro recibe y un producto de
 * ejemplo. Todo sale de `STORE_KINDS`, `PRESETS` y `PRESET_LIST`: si cambia
 * un preset o un rubro, la landing cambia sola.
 */

export type SpecimenKind = Exclude<StoreKind, "otro">;

export type PresetKey = keyof typeof PRESETS;

interface SampleProduct {
  name: string;
  price: number;
  compareAt: number;
}

/** Producto de ejemplo por rubro (copy real, nada de "Producto 1"). */
export const SPECIMEN_PRODUCTS: Record<SpecimenKind, SampleProduct> = {
  moda: { name: "Campera de gabardina", price: 89000, compareAt: 104000 },
  artesanias: { name: "Jarra de cerámica esmaltada 1 L", price: 18900, compareAt: 21000 },
  tecnologia: { name: "Pava eléctrica de acero 1,7 L", price: 42500, compareAt: 49900 },
  marca: { name: "Buzo de frisa oversize", price: 54000, compareAt: 62000 },
  gaming: { name: "Auriculares con micrófono USB", price: 67900, compareAt: 79900 },
  farmacia: { name: "Protector solar FPS 50 · 200 ml", price: 23400, compareAt: 27500 },
  libreria: { name: "Cuaderno A4 tapa dura · 80 hojas", price: 7800, compareAt: 9200 },
  muebles: { name: "Mesa ratona de lapacho", price: 310000, compareAt: 365000 },
  mayorista: { name: "Cinta de embalar 48 mm · caja × 36", price: 52200, compareAt: 58000 },
  gourmet: { name: "Malbec de Valle de Uco 750 ml", price: 16500, compareAt: 19400 },
};

/** Texto del botón de la muestra: el mismo de la card real (DESIGN.md §2.8). */
export const SPECIMEN_BUTTON = "Agregar al carrito";

export interface Specimen {
  kind: SpecimenKind;
  /** "Moda y accesorios" (título de la muestra, en la fuente de títulos del preset). */
  label: string;
  /** "Ropa, joyería, marroquinería". */
  hint: string;
  presetId: PresetKey;
  presetName: string;
  mood: string;
  theme: Theme;
  product: SampleProduct;
}

export function presetSpecimens(): Specimen[] {
  return STORE_KINDS.flatMap((k) => {
    if (k.id === "otro") return [];
    const meta = PRESET_LIST.find((p) => p.id === k.preset);
    return [
      {
        kind: k.id,
        label: k.label,
        hint: k.hint,
        presetId: k.preset,
        presetName: meta?.name ?? k.preset,
        mood: meta?.mood ?? "",
        theme: PRESETS[k.preset],
        product: SPECIMEN_PRODUCTS[k.id],
      },
    ];
  });
}

/**
 * Primer plan (en el orden público) que permite usar el preset, o `null` si
 * no hay planes cargados. Usa la misma regla que el guardado del tema.
 */
export function presetMinPlan<P extends Pick<PlanInfo, "features">>(plans: readonly P[], presetId: PresetKey): P | null {
  return plans.find((p) => isPresetAllowed(p, presetId)) ?? null;
}

/** Caracteres únicos (con sus mayúsculas: hay presets con títulos y botones en mayúsculas), ordenados. */
export function glyphSubset(texts: readonly string[]): string {
  const chars = new Set<string>();
  for (const t of texts) for (const ch of `${t}${t.toUpperCase()}`) chars.add(ch);
  return [...chars].sort().join("");
}

/**
 * Hoja de Google Fonts de uno o más temas, recortada con `text=` a los
 * glifos que se usan: en vez de familias completas baja un archivo de pocos
 * KB por familia. Google responde cada `@font-face` con su `unicode-range`,
 * así que dos hojas con la misma familia se suman sin pisarse.
 */
export function specimenFontsHref(themes: readonly Theme[], texts: readonly string[]): string | null {
  const href = googleHref(
    themes.flatMap((t) => [
      { id: t.fonts.heading, weights: [t.fonts.headingWeight] },
      { id: t.fonts.body, weights: [t.fonts.bodyWeight, Math.min(t.fonts.bodyWeight + 200, 700)] },
    ]),
  );
  const text = glyphSubset(texts);
  return href && text ? `${href}&text=${encodeURIComponent(text)}` : href;
}

/** Textos que una muestra dibuja con las fuentes de su preset (`planLabel`: el de `specimenPlanLabel`). */
export function specimenTexts(s: Specimen, planLabel: string | null): string[] {
  return [
    s.label,
    s.hint,
    s.presetName,
    s.product.name,
    formatMoney(s.product.price),
    formatMoney(s.product.compareAt),
    SPECIMEN_BUTTON,
    ...(planLabel ? [` · ${planLabel}`] : []),
  ];
}

/**
 * Una hoja de fuentes por preset (sus 2 familias), con los textos de todos
 * los lugares de la landing que lo usan (la muestra y, para `mercado`, el
 * mock del hero). Así la página no pide las 20 familias de golpe: cada hoja
 * la inyecta `LazyFontSheets` cuando su elemento se acerca al viewport
 * (docs/DESIGN.md §8.19, excepción de la landing).
 */
export function specimenFontSheets(uses: readonly { presetId: PresetKey; texts: readonly string[] }[]): Partial<Record<PresetKey, string>> {
  const texts = new Map<PresetKey, string[]>();
  for (const u of uses) texts.set(u.presetId, [...(texts.get(u.presetId) ?? []), ...u.texts]);
  const out: Partial<Record<PresetKey, string>> = {};
  for (const [id, t] of texts) {
    const href = specimenFontsHref([PRESETS[id]], t);
    if (href) out[id] = href;
  }
  return out;
}
