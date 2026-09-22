/*
 * Ficha técnica (`products.specs` = [{label, value}]): normalización y
 * parser de texto pegado ("Material: Algodón" por línea, o tabla con tabs).
 */

export interface SpecRow {
  label: string;
  value: string;
}

export const MAX_SPECS = 50;

/** Lee `specs` de la DB (jsonb) tolerando basura. */
export function parseSpecsJson(value: unknown): SpecRow[] {
  if (!Array.isArray(value)) return [];
  const out: SpecRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const val = typeof r.value === "string" ? r.value.trim() : typeof r.value === "number" ? String(r.value) : "";
    if (label || val) out.push({ label, value: val });
  }
  return out.slice(0, MAX_SPECS);
}

/** Quita filas vacías y espacios sobrantes. */
export function cleanSpecs(rows: SpecRow[]): SpecRow[] {
  return rows
    .map((r) => ({ label: r.label.trim(), value: r.value.trim() }))
    .filter((r) => r.label && r.value)
    .slice(0, MAX_SPECS);
}

/**
 * Texto → filas. Acepta por línea "Etiqueta: valor", "Etiqueta<TAB>valor"
 * (copiado de una planilla) o "Etiqueta - valor". Ignora líneas sin separador.
 */
export function parseSpecsText(text: string): SpecRow[] {
  const rows: SpecRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s•*·-]+/, "").trim();
    if (!line) continue;
    const match = line.match(/^([^\t:]+?)\s*(?:\t+|:\s*|\s+-\s+)(.+)$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (label && value) rows.push({ label, value });
  }
  return rows.slice(0, MAX_SPECS);
}
