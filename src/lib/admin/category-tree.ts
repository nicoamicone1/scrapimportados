/*
 * Árbol de categorías (lógica pura): armar el árbol, aplanarlo con
 * profundidad (para la lista con drag & drop), proyectar la profundidad
 * al arrastrar y convertir la lista plana en `{id, parent_id, position}`.
 */

export interface CategoryNodeInput {
  id: string;
  parent_id: string | null;
  position: number;
  name: string;
}

export interface FlatCategory<T extends CategoryNodeInput = CategoryNodeInput> {
  item: T;
  id: string;
  parentId: string | null;
  depth: number;
}

export const MAX_CATEGORY_DEPTH = 3;

function sortSiblings<T extends CategoryNodeInput>(a: T, b: T) {
  return a.position - b.position || a.name.localeCompare(b.name, "es");
}

/** Lista plana en orden de árbol (padre, hijas, nietas…). Huérfanas van a la raíz. */
export function flattenTree<T extends CategoryNodeInput>(items: T[]): FlatCategory<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parent_id && ids.has(item.parent_id) && item.parent_id !== item.id ? item.parent_id : null;
    const list = children.get(parent) ?? [];
    list.push(item);
    children.set(parent, list);
  }
  const out: FlatCategory<T>[] = [];
  const visited = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const item of (children.get(parent) ?? []).sort(sortSiblings)) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      out.push({ item, id: item.id, parentId: parent, depth });
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  // Ciclos (no deberían existir): se agregan a la raíz para no perderlos.
  for (const item of items) {
    if (!visited.has(item.id)) {
      visited.add(item.id);
      out.push({ item, id: item.id, parentId: null, depth: 0 });
      walk(item.id, 1);
    }
  }
  return out;
}

/** Ids de todas las descendientes de `id`. */
export function descendantsOf(items: CategoryNodeInput[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    for (const item of items) {
      if (item.parent_id === current && !out.has(item.id)) {
        out.add(item.id);
        stack.push(item.id);
      }
    }
  }
  return out;
}

/** "Hogar / Cocina / Vajilla" */
export function categoryPath(items: CategoryNodeInput[], id: string): string {
  const byId = new Map(items.map((i) => [i.id, i]));
  const parts: string[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return parts.join(" / ");
}

/** Mueve un elemento (y su subárbol) de `from` a `to` en una lista plana. */
export function moveFlat<T extends CategoryNodeInput>(flat: FlatCategory<T>[], activeId: string, overId: string): FlatCategory<T>[] {
  const from = flat.findIndex((f) => f.id === activeId);
  const to = flat.findIndex((f) => f.id === overId);
  if (from === -1 || to === -1 || from === to) return flat;
  // Bloque = el elemento + sus descendientes contiguos.
  let end = from + 1;
  while (end < flat.length && flat[end].depth > flat[from].depth) end++;
  const block = flat.slice(from, end);
  if (to > from && to < end) return flat; // soltar dentro de su propio subárbol
  const rest = [...flat.slice(0, from), ...flat.slice(end)];
  let insertAt = rest.findIndex((f) => f.id === overId);
  if (to > from) insertAt += 1;
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
}

/**
 * Profundidad posible para el elemento en `index` (ya movido), dada la
 * profundidad deseada por el arrastre horizontal. Devuelve `depth` y `parentId`.
 */
export function projectDepth<T extends CategoryNodeInput>(
  flat: FlatCategory<T>[],
  index: number,
  desiredDepth: number,
  maxDepth = MAX_CATEGORY_DEPTH - 1,
  /** false si `flat` ya NO incluye las descendientes del elemento (se ocultan al arrastrar). */
  subtreeInList = true,
): { depth: number; parentId: string | null } {
  const current = flat[index];
  const prev = flat[index - 1];
  // Saltear el subárbol del elemento (se mueve con él).
  let end = index + 1;
  let height = 0;
  while (subtreeInList && end < flat.length && flat[end].depth > current.depth) {
    height = Math.max(height, flat[end].depth - current.depth);
    end++;
  }
  const next = flat[end];
  const max = prev ? Math.max(0, Math.min(prev.depth + 1, maxDepth - height)) : 0;
  const min = next ? next.depth : 0;
  const depth = Math.max(Math.min(desiredDepth, max), Math.min(min, max));
  if (depth === 0 || !prev) return { depth: 0, parentId: null };
  // El padre es el anterior más cercano con depth - 1.
  for (let i = index - 1; i >= 0; i--) {
    if (flat[i].depth === depth - 1) return { depth, parentId: flat[i].id };
  }
  return { depth: 0, parentId: null };
}

/**
 * Aplica una nueva profundidad al elemento `id` (y desplaza su subárbol),
 * recalculando `parentId` de todos según las profundidades.
 */
export function setDepth<T extends CategoryNodeInput>(flat: FlatCategory<T>[], id: string, depth: number): FlatCategory<T>[] {
  const index = flat.findIndex((f) => f.id === id);
  if (index === -1) return flat;
  const diff = depth - flat[index].depth;
  let end = index + 1;
  while (end < flat.length && flat[end].depth > flat[index].depth) end++;
  const next = flat.map((f, i) => (i >= index && i < end ? { ...f, depth: Math.max(0, f.depth + diff) } : f));
  return reparent(next);
}

/**
 * Soltar `activeId` (con su subárbol) en el lugar de `overId` con profundidad
 * `depth`. El bloque se calcula ANTES de mover (después, lo que queda debajo
 * podría confundirse con hijas). Devuelve la lista con `parentId` recalculado.
 */
export function applyDrop<T extends CategoryNodeInput>(
  flat: FlatCategory<T>[],
  activeId: string,
  overId: string,
  depth: number,
): FlatCategory<T>[] {
  const from = flat.findIndex((f) => f.id === activeId);
  if (from === -1) return flat;
  let end = from + 1;
  while (end < flat.length && flat[end].depth > flat[from].depth) end++;
  const diff = depth - flat[from].depth;
  const block = flat.slice(from, end).map((f) => ({ ...f, depth: Math.max(0, f.depth + diff) }));
  const blockIds = new Set(block.map((f) => f.id));
  if (activeId !== overId && blockIds.has(overId)) return flat; // dentro de su propio subárbol
  const rest = [...flat.slice(0, from), ...flat.slice(end)];
  let insertAt = from;
  if (activeId !== overId) {
    const to = flat.findIndex((f) => f.id === overId);
    insertAt = rest.findIndex((f) => f.id === overId);
    if (to > from) insertAt += 1;
  }
  return reparent([...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]);
}

/** Recalcula `parentId` a partir de las profundidades (normaliza saltos). */
export function reparent<T extends CategoryNodeInput>(flat: FlatCategory<T>[]): FlatCategory<T>[] {
  const stack: FlatCategory<T>[] = [];
  return flat.map((f) => {
    let depth = Math.min(f.depth, stack.length);
    while (stack.length > depth) stack.pop();
    depth = stack.length;
    const parentId = depth === 0 ? null : stack[depth - 1].id;
    const out = { ...f, depth, parentId };
    stack.push(out);
    return out;
  });
}

/** Lista plana → filas para `reorder_categories` (posición por hermanos). */
export function toReorderItems(flat: FlatCategory[]): { id: string; parent_id: string | null; position: number }[] {
  const counters = new Map<string | null, number>();
  return flat.map((f) => {
    const position = counters.get(f.parentId) ?? 0;
    counters.set(f.parentId, position + 1);
    return { id: f.id, parent_id: f.parentId, position };
  });
}
