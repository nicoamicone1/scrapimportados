/**
 * Serialización CSV (RFC 4180) para las exportaciones del admin. Pura.
 * - Separador `,`, fin de línea `\r\n`, UTF-8 con BOM (Excel lo abre bien).
 * - Comillas dobles cuando el valor tiene `,`, `"`, saltos de línea o
 *   espacios en los bordes; las comillas internas se duplican.
 * - Números sin separador de miles y con punto decimal; booleanos
 *   `true`/`false`; fechas en ISO 8601 (UTC).
 * - Fórmulas: un texto que empieza con `=` se prefija con `'` para que Excel
 *   no lo ejecute (no se toca `+`/`-`/`@`: teléfonos, negativos, handles).
 */

export const CSV_BOM = "﻿";

export type CsvValue = string | number | boolean | Date | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value instanceof Date ? value.toISOString() : value;
  if (text.startsWith("=")) text = `'${text}`;
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvLine(cells: readonly CsvValue[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** CSV completo en memoria (para tests y exportaciones chicas). */
export function toCsv(header: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return CSV_BOM + csvLine(header) + rows.map(csvLine).join("");
}

/** Fecha ISO normalizada (o vacío). Acepta lo que devuelve Postgres. */
export function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Parser CSV mínimo (comillas, `""`, saltos de línea dentro de comillas).
 * Lo usa la importación de redirecciones. Devuelve filas de celdas.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === "," || ch === ";") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------------
// Rangos de fechas en la zona horaria de la tienda (filtros de export y auditoría)
// ---------------------------------------------------------------------

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en `date`. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/** Medianoche de `day` (YYYY-MM-DD) en `timeZone`, como Date UTC. */
export function zonedMidnight(day: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** `[desde 00:00, hasta+1 00:00)` en la zona de la tienda → ISO (o null si no hay filtro). */
export function zonedDayRange(
  from: string | null | undefined,
  to: string | null | undefined,
  timeZone: string,
): { fromIso: string | null; toIso: string | null } {
  const start = from ? zonedMidnight(from, timeZone) : null;
  let end: Date | null = null;
  if (to) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
    if (m) {
      const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
      end = zonedMidnight(next.toISOString().slice(0, 10), timeZone);
    }
  }
  return { fromIso: start?.toISOString() ?? null, toIso: end?.toISOString() ?? null };
}
