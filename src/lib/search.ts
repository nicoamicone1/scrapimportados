/**
 * Buscador compartido: lo usan el desplegable del header (índice liviano
 * generado en build) y el listado de `/productos` (mismo matcher, así los
 * resultados coinciden). Módulo puro: no importa `node:fs`.
 */

import { normalizeText } from "./format";

/** Entrada del índice liviano que el layout le pasa al Header. */
export interface SearchEntry {
  id: number;
  slug: string;
  name: string;
  sku: string;
  image: string | null;
  /** Precio FINAL en efectivo (el `base` del proveedor nunca llega acá). */
  priceEfectivo: number;
}

/** Mínimo que necesita el matcher. Lo cumplen `SearchEntry` y `CatalogItem`. */
export interface Searchable {
  name: string;
  sku: string;
}

/** Nombre + SKU normalizados, para no recalcularlos en cada tecla. */
export interface Haystack {
  name: string;
  sku: string;
}

export function haystackOf(item: Searchable): Haystack {
  return { name: normalizeText(item.name), sku: normalizeText(item.sku) };
}

/** "  Auricular BT " -> ["auricular", "bt"] (sin acentos, en minúsculas). */
export function tokenize(query: string): string[] {
  return normalizeText(query).trim().split(/\s+/).filter(Boolean);
}

/**
 * Puntaje del producto para esos tokens. `0` = no matchea.
 * Todos los tokens tienen que aparecer (en el nombre o en el SKU).
 */
export function scoreHaystack(hay: Haystack, tokens: string[]): number {
  if (tokens.length === 0) return 0;

  let score = 0;
  for (const token of tokens) {
    const at = hay.name.indexOf(token);
    if (at === 0) {
      score += 4; // arranca el nombre
    } else if (at > 0) {
      score += hay.name[at - 1] === " " ? 3 : 1; // arranca una palabra
    } else if (hay.sku.includes(token)) {
      score += hay.sku === token ? 5 : 2; // SKU exacto manda
    } else {
      return 0;
    }
  }
  return score;
}

export function matches(hay: Haystack, tokens: string[]): boolean {
  return scoreHaystack(hay, tokens) > 0;
}

/**
 * Busca y ordena por relevancia (desempate alfabético). `limit` recorta
 * el resultado; `count` de `searchWithCount` devuelve el total sin recortar.
 */
export function searchProducts<T extends Searchable>(
  items: T[],
  query: string,
  limit?: number,
): T[] {
  return searchWithCount(items, query, limit).results;
}

export function searchWithCount<T extends Searchable>(
  items: T[],
  query: string,
  limit?: number,
): { results: T[]; count: number } {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { results: [], count: 0 };

  const hits: { item: T; score: number }[] = [];
  for (const item of items) {
    const score = scoreHaystack(haystackOf(item), tokens);
    if (score > 0) hits.push({ item, score });
  }

  hits.sort(
    (a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "es-AR"),
  );

  const results = (typeof limit === "number" ? hits.slice(0, limit) : hits).map(
    (h) => h.item,
  );
  return { results, count: hits.length };
}

/* ------------------------------------------------------------------ */
/* Resaltado del texto que matcheó                                      */
/* ------------------------------------------------------------------ */

export interface HighlightPart {
  text: string;
  hit: boolean;
}

/**
 * Parte el nombre original en tramos marcando lo que matcheó.
 * `normalizeText` no cambia la longitud (NFD + saca diacríticos), así que
 * los índices del texto normalizado sirven para cortar el original; si por
 * algún carácter raro no coincidieran, se devuelve el nombre sin resaltar.
 */
export function highlight(name: string, tokens: string[]): HighlightPart[] {
  const plain: HighlightPart[] = [{ text: name, hit: false }];
  const normalized = normalizeText(name);
  if (tokens.length === 0 || normalized.length !== name.length) return plain;

  const ranges: [number, number][] = [];
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const at = normalized.indexOf(token, from);
      if (at < 0) break;
      ranges.push([at, at + token.length]);
      from = at + token.length;
    }
  }
  if (ranges.length === 0) return plain;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: name.slice(cursor, start), hit: false });
    parts.push({ text: name.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < name.length) parts.push({ text: name.slice(cursor), hit: false });
  return parts;
}
