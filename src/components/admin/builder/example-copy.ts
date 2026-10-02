import { createBlock, PAGE_TEMPLATES_META, PALETTE_ORDER } from "@/lib/blocks/defaults";
import type { Block, BlockType } from "@/lib/blocks/schema";

/*
 * Texto de ejemplo sin tocar (DESIGN.md §1.1: "Lorem ipsum … se publica por
 * error"). Los defaults del builder traen copy real en rioplatense, pero con
 * datos que son de OTRA tienda ("Empezamos en 2012 con un local chico en
 * Morón", "10 % off con transferencia", "Despachamos en 24 a 48 hs"):
 * publicados tal cual, son afirmaciones falsas frente al cliente. Antes de
 * publicar, el editor avisa qué bloques los conservan.
 */

/** Campos que llevan afirmaciones (no títulos genéricos como "Novedades" o "Preguntas frecuentes"). */
const CLAIM_KEYS = new Set(["title", "subtitle", "text", "html", "a", "expiredText"]);
/** Por debajo de este largo son títulos o CTAs genéricos que sirven a cualquier tienda. */
const MIN_LENGTH = 30;
/** Bloques cuyo copy por defecto es genérico y verdadero para cualquiera. */
const GENERIC: ReadonlySet<BlockType> = new Set(["product_slider", "product_grid", "category_list", "heading", "divider", "video", "testimonials", "print3d_cta"]);

function collect(value: unknown, out: string[], key?: string) {
  if (typeof value === "string") {
    if (key && CLAIM_KEYS.has(key) && value.trim().length >= MIN_LENGTH) out.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const v of value) collect(v, out, key);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collect(v, out, k);
  }
}

let examples: Set<string> | null = null;

/** Todo el copy de ejemplo: el de cada bloque nuevo y el de las plantillas de página. */
function exampleStrings(): Set<string> {
  if (examples) return examples;
  const out: string[] = [];
  for (const type of PALETTE_ORDER) collect(createBlock(type).settings, out);
  for (const tpl of PAGE_TEMPLATES_META) for (const b of tpl.build()) collect(b.settings, out);
  examples = new Set(out);
  return examples;
}

/** ¿El bloque conserva alguna frase de ejemplo? (Los ocultos no cuentan: no se ven en la tienda.) */
export function hasExampleCopy(block: Block): boolean {
  if (block.style.hidden || GENERIC.has(block.type)) return false;
  const found: string[] = [];
  collect(block.settings, found);
  const known = exampleStrings();
  return found.some((s) => known.has(s));
}

export function blocksWithExampleCopy(blocks: readonly Block[]): Block[] {
  return blocks.filter(hasExampleCopy);
}
