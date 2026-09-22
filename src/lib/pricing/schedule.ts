/*
 * Vigencia de promociones y cupones + conversión de fechas entre la zona de
 * la tienda (`store_settings.timezone`) y UTC para inputs `datetime-local`.
 * Puro (sin dependencias), testeado.
 */

export type ScheduleStatus = "scheduled" | "active" | "expired" | "paused";

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: "Programada",
  active: "Activa",
  expired: "Vencida",
  paused: "Pausada",
};

/**
 * Estado calculado: pausada (is_active = false) > vencida > programada > activa.
 * Una promo pausada Y vencida se muestra como vencida (no tiene sentido reactivarla).
 */
export function scheduleStatus(
  item: { isActive: boolean; startsAt?: string | null; endsAt?: string | null },
  now: Date = new Date(),
): ScheduleStatus {
  const t = now.getTime();
  if (item.endsAt && new Date(item.endsAt).getTime() < t) return "expired";
  if (!item.isActive) return "paused";
  if (item.startsAt && new Date(item.startsAt).getTime() > t) return "scheduled";
  return "active";
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Offset (ms) de la zona `timeZone` en el instante `date`: local − UTC. */
function zoneOffsetMs(date: Date, timeZone: string): number {
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
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * "2026-11-02T00:00" (hora de la tienda) → ISO UTC. Vacío o inválido → null.
 *   zonedLocalToIso("2026-11-02T00:00", "America/Argentina/Buenos_Aires") → "2026-11-02T03:00:00.000Z"
 */
export function zonedLocalToIso(local: string | null | undefined, timeZone: string): string | null {
  const m = LOCAL_RE.exec((local ?? "").trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (Number.isNaN(guess)) return null;
  let t = guess - zoneOffsetMs(new Date(guess), timeZone);
  // Segundo paso por si el offset cambia en ese instante (horario de verano).
  const second = guess - zoneOffsetMs(new Date(t), timeZone);
  if (second !== t) t = second;
  return new Date(t).toISOString();
}

/** ISO UTC → "YYYY-MM-DDTHH:mm" en la zona de la tienda (para `datetime-local`). */
export function isoToZonedLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() + zoneOffsetMs(date, timeZone));
  return local.toISOString().slice(0, 16);
}
