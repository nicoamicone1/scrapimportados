/*
 * Helpers puros de alcance y estado para el admin de precios, promociones y
 * cupones (agente C).
 */

import { scheduleStatus, type ScheduleStatus } from "./schedule";

export interface CategoryLite {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
}

export interface CategoryTreeRow extends CategoryLite {
  depth: number;
  /** "Hogar / Cocina" */
  path: string;
}

/** Lista plana en orden de árbol con profundidad y ruta. Huérfanas a la raíz. */
export function categoryTree(categories: readonly CategoryLite[]): CategoryTreeRow[] {
  const ids = new Set(categories.map((c) => c.id));
  const children = new Map<string | null, CategoryLite[]>();
  for (const c of categories) {
    const parent = c.parentId && ids.has(c.parentId) && c.parentId !== c.id ? c.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(c);
    children.set(parent, list);
  }
  const out: CategoryTreeRow[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, prefix: string) => {
    const list = (children.get(parent) ?? []).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "es"));
    for (const c of list) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const path = prefix ? `${prefix} / ${c.name}` : c.name;
      out.push({ ...c, depth, path });
      walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  for (const c of categories) if (!seen.has(c.id)) out.push({ ...c, depth: 0, path: c.name });
  return out;
}

/** Ids de las descendientes (hijas, nietas…) de `id`, sin incluirla. */
export function categoryDescendants(categories: readonly CategoryLite[], id: string): string[] {
  const byParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c.id);
    byParent.set(c.parentId, list);
  }
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const stack = [...(byParent.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    stack.push(...(byParent.get(next) ?? []));
  }
  return out;
}

/** Selección + todas sus descendientes, sin duplicados y sólo ids existentes. */
export function expandCategoryIds(categories: readonly CategoryLite[], ids: readonly string[]): string[] {
  const exists = new Set(categories.map((c) => c.id));
  const out = new Set<string>();
  for (const id of ids) {
    if (!exists.has(id)) continue;
    out.add(id);
    for (const d of categoryDescendants(categories, id)) out.add(d);
  }
  return [...out];
}

/**
 * Nombres para mostrar una selección de categorías: si una categoría y
 * TODAS sus descendientes están elegidas, se muestra sólo la madre.
 */
export function summarizeCategorySelection(categories: readonly CategoryLite[], ids: readonly string[]): string[] {
  const selected = new Set(ids);
  const covered = new Set<string>();
  const names: string[] = [];
  for (const row of categoryTree(categories)) {
    if (!selected.has(row.id) || covered.has(row.id)) continue;
    names.push(row.name);
    const desc = categoryDescendants(categories, row.id);
    if (desc.every((d) => selected.has(d))) desc.forEach((d) => covered.add(d));
  }
  // Ids desconocidos (categoría borrada) se ignoran.
  return names;
}

export type CouponStatus = ScheduleStatus | "exhausted";

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  scheduled: "Programado",
  active: "Activo",
  expired: "Vencido",
  paused: "Pausado",
  exhausted: "Agotado",
};

/** Estado de un cupón: como las promos + "agotado" si llegó al máximo de usos. */
export function couponStatus(
  coupon: { isActive: boolean; startsAt?: string | null; endsAt?: string | null; usesCount: number; maxUses: number | null },
  now: Date = new Date(),
): CouponStatus {
  const base = scheduleStatus(coupon, now);
  if (base === "expired" || base === "paused") return base;
  if (coupon.maxUses != null && coupon.usesCount >= coupon.maxUses) return "exhausted";
  return base;
}
