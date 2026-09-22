/**
 * Matcher de búsqueda del storefront (puro: server y client).
 *
 * - Sin acentos ni mayúsculas ("Lámpara" = "lampara").
 * - Por tokens: TODOS los términos tienen que aparecer (en cualquier orden)
 *   en nombre + SKU + marca + tags.
 * - Relevancia: pesa más el nombre (y el comienzo de palabra) que el SKU o la marca.
 */

/** Minúsculas, sin acentos, puntuación → espacio. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Taladro  percutor 13mm" → ["taladro", "percutor", "13mm"] (sin duplicados, máx. 8). */
export function searchTokens(query: string): string[] {
  const out: string[] = [];
  for (const t of normalizeSearch(query).split(" ")) {
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

export interface Searchable {
  name: string;
  sku?: string | null;
  /** SKUs de todas las variantes. */
  skus?: (string | null)[];
  brand?: string | null;
  tags?: string[];
}

/** Texto indexable (ya normalizado) de un producto. */
export function searchText(item: Searchable): string {
  return normalizeSearch(
    [item.name, item.brand ?? "", item.sku ?? "", ...(item.skus ?? []).map((s) => s ?? ""), ...(item.tags ?? [])].join(" "),
  );
}

/** ¿Todos los tokens aparecen en el texto normalizado? Sin tokens → true. */
export function matchesTokens(text: string, tokens: string[]): boolean {
  return tokens.every((t) => text.includes(t));
}

/**
 * Puntaje de relevancia (mayor = mejor). 0 si no matchea.
 * Nombre: +10 por token al comienzo de palabra, +6 si está adentro;
 * SKU exacto +12; marca +3; frase completa al inicio del nombre +8.
 */
export function searchScore(item: Searchable, tokens: string[]): number {
  if (!tokens.length) return 0;
  const text = searchText(item);
  if (!matchesTokens(text, tokens)) return 0;
  const name = normalizeSearch(item.name);
  const words = name.split(" ");
  const brand = normalizeSearch(item.brand ?? "");
  const skus = [item.sku, ...(item.skus ?? [])].filter(Boolean).map((s) => normalizeSearch(s as string));
  let score = 1;
  for (const t of tokens) {
    if (words.some((w) => w.startsWith(t))) score += 10;
    else if (name.includes(t)) score += 6;
    if (skus.some((s) => s === t)) score += 12;
    else if (skus.some((s) => s.includes(t))) score += 4;
    if (brand && brand.includes(t)) score += 3;
  }
  if (name.startsWith(tokens.join(" "))) score += 8;
  return score;
}
