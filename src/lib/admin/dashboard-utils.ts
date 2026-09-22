/**
 * Lógica PURA del dashboard: períodos en la zona horaria de la tienda,
 * comparación contra el período anterior y armado de la serie del gráfico.
 * Testeada en `orders-logic.test.ts`.
 */

export const PERIODS = ["hoy", "7d", "30d"] as const;
export type PeriodKey = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  hoy: "Hoy",
  "7d": "7 días",
  "30d": "30 días",
};

export function parsePeriod(value: unknown): PeriodKey {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value) ? (value as PeriodKey) : "7d";
}

// ---------------------------------------------------------------------
// Zona horaria (sin librerías: Intl alcanza)
// ---------------------------------------------------------------------

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = domingo
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(timeZone: string) {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of dtf(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en ese instante. */
function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC de las 00:00 del día (y, m, d) en `timeZone`. */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let t = guess - offsetMs(new Date(guess), timeZone);
  // Segunda pasada por si el offset cambia ese día (horario de verano).
  t = guess - offsetMs(new Date(t), timeZone);
  return new Date(t);
}

/** 00:00 del día de `date` en `timeZone`. */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedMidnight(p.year, p.month, p.day, timeZone);
}

/** Suma días calendario en `timeZone` y devuelve la medianoche de ese día. */
export function addZonedDays(dayStart: Date, days: number, timeZone: string): Date {
  const p = zonedParts(new Date(dayStart.getTime() + 12 * 3600_000), timeZone);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedMidnight(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), timeZone);
}

/** "2026-09-22" (día local de `timeZone`). */
export function zonedYmd(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "2026-09-22" → medianoche local; null si el texto no es una fecha. */
export function ymdToZonedStart(ymd: string | null | undefined, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return zonedMidnight(y, mo, d, timeZone);
}

// ---------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------

export interface Bucket {
  /** Clave comparable con la salida de `admin_sales_series` ("2026-09-22" o "15"). */
  key: string;
  /** Etiqueta corta para el eje ("22/9", "lun 22", "15 h"). */
  label: string;
  /** Etiqueta larga para el tooltip ("lunes 22/9", "15:00 a 16:00"). */
  title: string;
  /** Es el bucket actual (hoy / esta hora). */
  current: boolean;
}

export interface ResolvedPeriod {
  key: PeriodKey;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  bucket: "hour" | "day";
  buckets: Bucket[];
  /** "ayer a esta hora", "los 7 días anteriores"… */
  previousLabel: string;
}

const WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Período actual y anterior de igual duración.
 * - hoy: desde las 00:00 hasta ahora; anterior = ayer hasta la misma hora.
 * - 7d / 30d: los últimos N días incluyendo hoy; anterior = los N previos,
 *   cortado en el mismo tramo transcurrido.
 */
export function resolvePeriod(key: PeriodKey, now: Date, timeZone: string): ResolvedPeriod {
  const today = startOfZonedDay(now, timeZone);
  const elapsed = now.getTime() - today.getTime();

  if (key === "hoy") {
    const prevFrom = addZonedDays(today, -1, timeZone);
    const currentHour = zonedParts(now, timeZone).hour;
    const buckets: Bucket[] = Array.from({ length: 24 }, (_, h) => ({
      key: String(h).padStart(2, "0"),
      label: `${h} h`,
      title: `${String(h).padStart(2, "0")}:00 a ${String((h + 1) % 24).padStart(2, "0")}:00`,
      current: h === currentHour,
    }));
    return {
      key,
      from: today,
      to: now,
      prevFrom,
      prevTo: new Date(prevFrom.getTime() + elapsed),
      bucket: "hour",
      buckets,
      previousLabel: "ayer a esta hora",
    };
  }

  const days = key === "7d" ? 7 : 30;
  const from = addZonedDays(today, -(days - 1), timeZone);
  const prevFrom = addZonedDays(from, -days, timeZone);
  const prevTo = new Date(prevFrom.getTime() + (now.getTime() - from.getTime()));
  const buckets: Bucket[] = [];
  for (let i = 0; i < days; i++) {
    const day = addZonedDays(from, i, timeZone);
    const p = zonedParts(new Date(day.getTime() + 12 * 3600_000), timeZone);
    const dm = `${p.day}/${p.month}`;
    buckets.push({
      key: zonedYmd(new Date(day.getTime() + 12 * 3600_000), timeZone),
      label: days === 7 ? `${WEEKDAY_SHORT[p.weekday]} ${p.day}` : dm,
      title: `${WEEKDAY_LONG[p.weekday]} ${dm}`,
      current: i === days - 1,
    });
  }
  return {
    key,
    from,
    to: now,
    prevFrom,
    prevTo,
    bucket: "day",
    buckets,
    previousLabel: `los ${days} días anteriores`,
  };
}

/** Clave del bucket para una fila de `admin_sales_series` (timestamp local sin zona). */
export function seriesKey(bucketTimestamp: string, bucket: "hour" | "day"): string {
  // "2026-09-22T15:00:00" o "2026-09-22 15:00:00"
  return bucket === "day" ? bucketTimestamp.slice(0, 10) : bucketTimestamp.slice(11, 13);
}

export interface SeriesRow {
  bucket: string;
  orders: number;
  sales: number;
}

export interface SeriesPoint extends Bucket {
  orders: number;
  sales: number;
}

/** Completa con ceros los buckets sin ventas. */
export function fillSeries(buckets: readonly Bucket[], rows: readonly SeriesRow[], bucket: "hour" | "day"): SeriesPoint[] {
  const byKey = new Map<string, SeriesRow>();
  for (const r of rows) byKey.set(seriesKey(r.bucket, bucket), r);
  return buckets.map((b) => {
    const r = byKey.get(b.key);
    return { ...b, orders: Number(r?.orders ?? 0), sales: Number(r?.sales ?? 0) };
  });
}

export function sumSeries(rows: readonly { orders: number; sales: number }[]): { orders: number; sales: number } {
  return rows.reduce(
    (acc, r) => ({ orders: acc.orders + Number(r.orders), sales: acc.sales + Number(r.sales) }),
    { orders: 0, sales: 0 },
  );
}

// ---------------------------------------------------------------------
// Comparación
// ---------------------------------------------------------------------

export interface Comparison {
  /** Variación porcentual redondeada (null si no hay base). */
  percent: number | null;
  text: string;
  direction: "up" | "down" | "flat";
}

/** "+12 % vs. los 7 días anteriores" · "−8 % vs. ayer a esta hora". */
export function compare(current: number, previous: number, previousLabel: string): Comparison {
  if (!previous) {
    if (!current) return { percent: null, text: `Sin cambios vs. ${previousLabel}`, direction: "flat" };
    return { percent: null, text: `Nada para comparar con ${previousLabel}`, direction: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { percent: 0, text: `Igual que ${previousLabel}`, direction: "flat" };
  const sign = pct > 0 ? "+" : "−";
  return {
    percent: pct,
    text: `${sign}${Math.abs(pct)} % vs. ${previousLabel}`,
    direction: pct > 0 ? "up" : "down",
  };
}

/** Máximo "redondo" para el eje (1, 2, 2.5, 5 × 10^n) con 3 líneas guía. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * exp >= value) return step * exp;
  }
  return 10 * exp;
}
