/*
 * Lógica pura de opciones y variantes (sin dependencias de server/client).
 * - `cartesian`: combinaciones de valores de las opciones (orden estable).
 * - `buildVariantMatrix`: arma la matriz nueva CONSERVANDO las variantes
 *   existentes (match exacto por `option_values`, y si no hay, por
 *   compatibilidad: al agregar o quitar una opción, la variante vieja pasa a
 *   la primera combinación compatible con sus valores).
 */

export interface OptionInput {
  name: string;
  values: string[];
}

export type OptionValues = Record<string, string>;

export const MAX_OPTIONS = 3;
export const MAX_VARIANTS = 250;
export const DEFAULT_VARIANT_TITLE = "Default";

/** Opciones utilizables: con nombre y al menos un valor (limpias y sin duplicados). */
export function cleanOptions(options: OptionInput[]): OptionInput[] {
  const out: OptionInput[] = [];
  const seen = new Set<string>();
  for (const o of options) {
    const name = o.name.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    const values: string[] = [];
    const seenValues = new Set<string>();
    for (const v of o.values) {
      const value = v.trim();
      if (!value || seenValues.has(value.toLowerCase())) continue;
      seenValues.add(value.toLowerCase());
      values.push(value);
    }
    if (!values.length) continue;
    seen.add(name.toLowerCase());
    out.push({ name, values });
  }
  return out.slice(0, MAX_OPTIONS);
}

/** Todas las combinaciones, en el orden de las opciones y sus valores. */
export function cartesian(options: OptionInput[]): OptionValues[] {
  let acc: OptionValues[] = [{}];
  for (const option of options) {
    const next: OptionValues[] = [];
    for (const combo of acc) {
      for (const value of option.values) next.push({ ...combo, [option.name]: value });
    }
    acc = next;
  }
  return acc;
}

/** Cantidad de variantes que generaría una lista de opciones. */
export function countCombinations(options: OptionInput[]): number {
  return options.reduce((n, o) => n * Math.max(1, o.values.length), 1);
}

/** Clave estable de un `option_values` (independiente del orden de las keys). */
export function optionKey(values: OptionValues): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((k) => [k, values[k]]),
  );
}

/** "Rojo / M" siguiendo el orden de las opciones; sin opciones → "Default". */
export function variantTitle(values: OptionValues, options: OptionInput[]): string {
  const parts = options.map((o) => values[o.name]).filter((v): v is string => Boolean(v));
  return parts.length ? parts.join(" / ") : DEFAULT_VARIANT_TITLE;
}

/** ¿Coinciden en todas las keys que comparten? */
function compatible(a: OptionValues, b: OptionValues): boolean {
  for (const key of Object.keys(a)) {
    if (key in b && b[key] !== a[key]) return false;
  }
  return true;
}

/**
 * Renombra una opción en los `option_values` de las variantes existentes
 * (para que al cambiar "Color" por "Colour" no se pierdan).
 */
export function renameOptionKey<T extends { option_values: OptionValues }>(variants: T[], from: string, to: string): T[] {
  if (from === to) return variants;
  return variants.map((v) => {
    if (!(from in v.option_values)) return v;
    const next: OptionValues = {};
    for (const [k, val] of Object.entries(v.option_values)) next[k === from ? to : k] = val;
    return { ...v, option_values: next };
  });
}

/** Renombra un valor de una opción en las variantes existentes. */
export function renameOptionValue<T extends { option_values: OptionValues }>(
  variants: T[],
  option: string,
  from: string,
  to: string,
): T[] {
  if (from === to) return variants;
  return variants.map((v) =>
    v.option_values[option] === from ? { ...v, option_values: { ...v.option_values, [option]: to } } : v,
  );
}

/**
 * Matriz de variantes para `options`, conservando las existentes.
 * `create(values, template)` arma una variante nueva (template = la primera
 * existente, para heredar precio, etc.). Devuelve las variantes en el orden
 * de la matriz, con `option_values` y `title` actualizados.
 */
export function buildVariantMatrix<T extends { option_values: OptionValues; title: string }>(
  rawOptions: OptionInput[],
  existing: T[],
  create: (values: OptionValues, template: T | undefined) => T,
): T[] {
  const options = cleanOptions(rawOptions);
  const combos = cartesian(options);
  const used = new Set<number>();
  const result: (T | undefined)[] = new Array(combos.length).fill(undefined);

  // 1) Match exacto.
  const byKey = new Map<string, number>();
  existing.forEach((v, i) => {
    const key = optionKey(v.option_values);
    if (!byKey.has(key)) byKey.set(key, i);
  });
  combos.forEach((combo, ci) => {
    const idx = byKey.get(optionKey(combo));
    if (idx !== undefined && !used.has(idx)) {
      used.add(idx);
      result[ci] = existing[idx];
    }
  });

  // 2) Compatibles (se agregó o quitó una opción).
  combos.forEach((combo, ci) => {
    if (result[ci]) return;
    const idx = existing.findIndex((v, i) => !used.has(i) && compatible(v.option_values, combo));
    if (idx !== -1) {
      used.add(idx);
      result[ci] = existing[idx];
    }
  });

  const template = existing[0];
  return combos.map((combo, ci) => {
    const base = result[ci] ?? create(combo, template);
    return { ...base, option_values: combo, title: variantTitle(combo, options) };
  });
}

/** Errores de opciones para mostrar en el form (índice → mensaje). */
export function validateOptions(options: OptionInput[]): Record<number, string> {
  const errors: Record<number, string> = {};
  const names = new Map<string, number>();
  options.forEach((o, i) => {
    const name = o.name.trim();
    if (!name) {
      errors[i] = "Poné un nombre a la opción.";
      return;
    }
    const key = name.toLowerCase();
    if (names.has(key)) {
      errors[i] = `Ya hay una opción "${name}".`;
      return;
    }
    names.set(key, i);
    const values = o.values.map((v) => v.trim().toLowerCase()).filter(Boolean);
    if (!values.length) errors[i] = "Agregá al menos un valor.";
    else if (new Set(values).size !== values.length) errors[i] = "Hay valores repetidos.";
  });
  if (options.length > MAX_OPTIONS) errors[MAX_OPTIONS] = `Hasta ${MAX_OPTIONS} opciones.`;
  return errors;
}
