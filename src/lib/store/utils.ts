import type { Json } from "@/lib/supabase/database.types";

/** Segundos de vida de las lecturas cacheadas del storefront (además de los tags). */
export const CACHE_REVALIDATE = 300;

export function asObject(value: Json | undefined): { [key: string]: Json | undefined } {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: Json | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: Json | undefined, fallback = 0): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function asBool(value: Json | undefined, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Escapa un término para `ilike` de PostgREST (%, _ y comas). */
export function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, " ");
}
