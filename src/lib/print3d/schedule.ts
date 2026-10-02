/*
 * Taller 3D — fecha estimada de entrega (spec §3.5). Reparte los trabajos
 * nuevos entre las impresoras (greedy) y cuenta días en la zona de la tienda
 * con fechas locales YYYY-MM-DD.
 */
import { fitsPrinter } from "./geometry";
import { round2 } from "./round";
import type { CalendarSettings, PrinterCapacity, ReadyEstimate, ScheduleJob } from "./types";

export const PRINT3D_TIMEZONE = "America/Argentina/Buenos_Aires";

const DAY_MS = 86_400_000;

/** Medianoche UTC del día local de `now` en `timeZone` (un "día calendario"). */
function localDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

/** ISO: 1 = lunes … 7 = domingo. */
function isoWeekday(day: number): number {
  return new Date(day).getUTCDay() || 7;
}

function ymd(day: number): string {
  return new Date(day).toISOString().slice(0, 10);
}

/**
 * Greedy: trabajos de mayor a menor duración, cada uno a la impresora
 * compatible (material + cama) con menos carga (arranca en su backlog).
 * Días de impresión = ceil(horas de la más cargada / horas útiles por día),
 * corridos; después se suman post-proceso + colchón en días hábiles y, si
 * cae en un día no hábil, pasa al siguiente hábil.
 * null si algún trabajo no tiene impresora compatible.
 */
export function estimateReadyDate(
  printers: PrinterCapacity[],
  jobs: ScheduleJob[],
  cal: CalendarSettings,
  now: Date = new Date(),
  timeZone: string = PRINT3D_TIMEZONE,
): ReadyEstimate | null {
  const load = printers.map((p) => Math.max(0, p.backlog_minutes || 0));
  const used = new Set<number>();
  const assignments: Record<number, string> = {};

  const order = jobs.map((_, i) => i).sort((a, b) => jobs[b].minutes_total - jobs[a].minutes_total || a - b);
  for (const j of order) {
    const job = jobs[j];
    let best = -1;
    printers.forEach((p, i) => {
      if (!p.materials.includes(job.material_type) || !fitsPrinter(job.bbox, p.bed)) return;
      if (best < 0 || load[i] < load[best]) best = i;
    });
    if (best < 0) return null;
    load[best] += Math.max(0, job.minutes_total);
    used.add(best);
    assignments[j] = printers[best].id;
  }

  const maxMinutes = Math.max(0, ...[...used].map((i) => load[i]));
  const printHours = maxMinutes / 60;
  const daily = cal.daily_print_hours > 0 ? cal.daily_print_hours : 24;
  const printDays = Math.ceil(printHours / daily);

  const working = new Set(cal.working_days.filter((d) => d >= 1 && d <= 7));
  const isWorking = (day: number) => working.size === 0 || working.has(isoWeekday(day));

  let day = localDay(now, timeZone) + printDays * DAY_MS;
  let pending = Math.max(0, Math.floor(cal.post_process_days)) + Math.max(0, Math.floor(cal.buffer_days));
  while (pending > 0) {
    day += DAY_MS;
    if (isWorking(day)) pending--;
  }
  while (!isWorking(day)) day += DAY_MS;

  return { date: ymd(day), assignments, printHours: round2(printHours) };
}
