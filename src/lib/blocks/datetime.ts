/*
 * Fechas "de pared" en la zona horaria de la tienda ↔ ISO UTC, sin
 * dependencias (para el input datetime-local de la cuenta regresiva).
 */

/** Offset (ms) de `timeZone` respecto de UTC en el instante `date`. */
function offsetMs(date: Date, timeZone: string): number {
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
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-30T23:59" (hora de la tienda) → ISO UTC. `null` si es inválida. */
export function zonedLocalToIso(local: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Dos pasadas por si el offset cambia justo en esa fecha (horario de verano).
  let ts = guess - offsetMs(new Date(guess), timeZone);
  ts = guess - offsetMs(new Date(ts), timeZone);
  const out = new Date(ts);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** ISO → "2026-11-30T23:59" en la hora de la tienda (para `datetime-local`). */
export function isoToZonedLocal(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + offsetMs(date, timeZone));
  return shifted.toISOString().slice(0, 16);
}
