import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale/es";

/**
 * Fechas. Las absolutas se formatean con `Intl` en la zona horaria de la
 * tienda (`store_settings.timezone`); las relativas con date-fns en español.
 */

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(value: DateInput, options: Intl.DateTimeFormatOptions, timeZone = DEFAULT_TIMEZONE) {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone }).format(d);
}

/** "22/09/2026" */
export function formatDate(value: DateInput, timeZone?: string): string {
  return fmt(value, { day: "2-digit", month: "2-digit", year: "numeric" }, timeZone);
}

/** "22/09/2026 15:45" */
export function formatDateTime(value: DateInput, timeZone?: string): string {
  return fmt(
    value,
    { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false },
    timeZone,
  ).replace(",", "");
}

/** "22 sept 2026" */
export function formatDateShort(value: DateInput, timeZone?: string): string {
  return fmt(value, { day: "numeric", month: "short", year: "numeric" }, timeZone).replace(/\./g, "");
}

/** "15:45" */
export function formatTime(value: DateInput, timeZone?: string): string {
  return fmt(value, { hour: "2-digit", minute: "2-digit", hour12: false }, timeZone);
}

/** "hace 5 minutos" */
export function formatRelative(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: es });
}

/** Valor para inputs `datetime-local` (hora local del navegador). */
export function toDateTimeLocalValue(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
