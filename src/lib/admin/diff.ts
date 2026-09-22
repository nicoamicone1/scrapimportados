import type { Json } from "@/lib/supabase/database.types";

/**
 * Diffs para la auditoría (puro). Formato guardado en `audit_log.diff`:
 * `{ "campo.sub": [antes, después] }` (claves planas con puntos).
 */

export type FlatDiff = Record<string, [Json, Json]>;

function isPlainObject(v: unknown): v is Record<string, Json | undefined> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Diff profundo de objetos JSON → claves planas. Los arrays se comparan enteros. */
export function flatDiff(before: Json | undefined, after: Json | undefined, prefix = "", out: FlatDiff = {}): FlatDiff {
  if (isPlainObject(before) && isPlainObject(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      flatDiff(before[key], after[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  const a = before === undefined ? null : before;
  const b = after === undefined ? null : after;
  if (JSON.stringify(a) !== JSON.stringify(b)) out[prefix || "valor"] = [a, b];
  return out;
}

/** Valores sensibles que no se guardan completos en la auditoría. */
export function redactDiff(diff: FlatDiff, keys: RegExp): FlatDiff {
  const out: FlatDiff = {};
  for (const [k, v] of Object.entries(diff)) out[k] = keys.test(k) ? ["(oculto)", "(oculto)"] : v;
  return out;
}

function show(v: Json | undefined, max: number): string {
  if (v === null || v === undefined || v === "") return "vacío";
  if (typeof v === "boolean") return v ? "sí" : "no";
  const text = typeof v === "string" ? v : JSON.stringify(v);
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

export interface DiffLine {
  field: string;
  before: string;
  after: string;
}

/**
 * Normaliza lo que haya en `diff` a líneas "campo: antes → después".
 * Soporta `{campo: [a, b]}`, `{campo: {from, to}}`, `{before, after}` y
 * cualquier otro JSON (se muestra como "campo: valor").
 */
export function diffLines(diff: Json | null | undefined, max = 120): DiffLine[] {
  if (diff === null || diff === undefined) return [];
  if (!isPlainObject(diff)) return [{ field: "detalle", before: "", after: show(diff, max) }];
  if (isPlainObject(diff.before) && isPlainObject(diff.after)) {
    return diffLines(flatDiff(diff.before, diff.after), max);
  }
  const lines: DiffLine[] = [];
  for (const [field, value] of Object.entries(diff)) {
    if (Array.isArray(value) && value.length === 2) {
      lines.push({ field, before: show(value[0], max), after: show(value[1], max) });
    } else if (isPlainObject(value) && ("from" in value || "to" in value)) {
      lines.push({ field, before: show(value.from, max), after: show(value.to, max) });
    } else {
      lines.push({ field, before: "", after: show(value, max) });
    }
  }
  return lines;
}
