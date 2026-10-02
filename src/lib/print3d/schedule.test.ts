import { describe, expect, it } from "vitest";

import { calibrationFactor } from "./calibration";
import { averageCostPerGram, jobCost, sumCosts } from "./cost";
import { estimateReadyDate } from "./schedule";
import type { CalendarSettings, CostContext, PrinterCapacity } from "./types";

const CAL: CalendarSettings = { daily_print_hours: 18, post_process_days: 1, buffer_days: 0, working_days: [1, 2, 3, 4, 5] };
const A1: PrinterCapacity = { id: "a1", bed: [256, 256, 256], materials: ["PLA", "PETG"], backlog_minutes: 600 };
const MINI: PrinterCapacity = { id: "mini", bed: [180, 180, 180], materials: ["PLA"], backlog_minutes: 0 };

/** Viernes 2 de octubre de 2026, 12:00 en Buenos Aires. */
const FRIDAY_NOON = new Date("2026-10-02T15:00:00Z");

describe("estimateReadyDate", () => {
  it("greedy + fin de semana: viernes + 2 días corridos = domingo → lunes hábil", () => {
    expect(FRIDAY_NOON.getUTCDay()).toBe(5);
    const jobs = [
      { minutes_total: 300, material_type: "PLA" as const, bbox: [100, 100, 100] as [number, number, number] },
      // 200 mm no entra en la mini: va a la A1 (600 + 900 = 1500 min = 25 h → 2 días).
      { minutes_total: 900, material_type: "PLA" as const, bbox: [200, 100, 50] as [number, number, number] },
    ];
    expect(estimateReadyDate([A1, MINI], jobs, CAL, FRIDAY_NOON)).toEqual({
      date: "2026-10-05",
      assignments: { 0: "mini", 1: "a1" },
      printHours: 25,
    });
  });

  it("usa el día de Argentina, no el de UTC (viernes 23 h = sábado en UTC)", () => {
    const lateFriday = new Date("2026-10-03T02:00:00Z");
    const cal = { ...CAL, post_process_days: 0 };
    expect(estimateReadyDate([MINI], [], cal, lateFriday)?.date).toBe("2026-10-02");
    // Sábado 3 en Argentina → pasa al lunes.
    expect(estimateReadyDate([MINI], [], cal, new Date("2026-10-03T15:00:00Z"))?.date).toBe("2026-10-05");
  });

  it("post-proceso + colchón en días hábiles", () => {
    const thursday = new Date("2026-10-01T15:00:00Z");
    const jobs = [{ minutes_total: 20 * 60, material_type: "PLA" as const, bbox: [50, 50, 50] as [number, number, number] }];
    // 20 h / 18 → 2 días → sábado 3; + 3 hábiles → miércoles 7.
    const r = estimateReadyDate([MINI], jobs, { ...CAL, post_process_days: 2, buffer_days: 1 }, thursday);
    expect(r).toEqual({ date: "2026-10-07", assignments: { 0: "mini" }, printHours: 20 });
  });

  it("reparte entre impresoras con menos carga", () => {
    const p = (id: string): PrinterCapacity => ({ id, bed: [256, 256, 256], materials: ["PLA"], backlog_minutes: 0 });
    const job = (m: number) => ({ minutes_total: m, material_type: "PLA" as const, bbox: [10, 10, 10] as [number, number, number] });
    const r = estimateReadyDate([p("x"), p("y")], [job(60), job(600), job(300), job(240)], CAL, FRIDAY_NOON);
    // 600 → x; 300 → y; 240 → y (540); 60 → y (600).
    expect(r?.assignments).toEqual({ 1: "x", 2: "y", 3: "y", 0: "y" });
    expect(r?.printHours).toBe(10);
  });

  it("sin impresora compatible → null", () => {
    const tpu = [{ minutes_total: 60, material_type: "TPU" as const, bbox: [10, 10, 10] as [number, number, number] }];
    expect(estimateReadyDate([A1, MINI], tpu, CAL, FRIDAY_NOON)).toBeNull();
    const huge = [{ minutes_total: 60, material_type: "PLA" as const, bbox: [300, 10, 10] as [number, number, number] }];
    expect(estimateReadyDate([A1, MINI], huge, CAL, FRIDAY_NOON)).toBeNull();
    expect(estimateReadyDate([], huge, CAL, FRIDAY_NOON)).toBeNull();
  });
});

describe("jobCost", () => {
  const ctx: CostContext = {
    spool_cost_per_gram: 20,
    printer: { watts: 150, purchase_price: 900_000, lifetime_hours: 5000 },
    kwh_price: 150,
    labor_hour_cost: 4000,
  };
  const inp = { grams: 100, minutes: 120, wasted_grams: 10, post_minutes: 30 };

  it("con bobina", () => {
    // luz 0,15 kW · 2 h · 150 = 45; amortización 180 $/h · 2 = 360; labor 0,5 h · 4000 = 2000
    expect(jobCost(inp, ctx)).toEqual({ material: 2000, energy: 45, amortization: 360, labor: 2000, waste: 200, total: 4605, incomplete: false });
  });

  it("sin bobina: material 0 e incompleto", () => {
    expect(jobCost(inp, { ...ctx, spool_cost_per_gram: null })).toEqual({
      material: 0,
      energy: 45,
      amortization: 360,
      labor: 2000,
      waste: 0,
      total: 2405,
      incomplete: true,
    });
  });

  it("sumCosts y costo promedio por gramo", () => {
    const a = jobCost(inp, ctx);
    const b = jobCost(inp, { ...ctx, spool_cost_per_gram: null });
    expect(sumCosts([a, b])).toEqual({ material: 2000, energy: 90, amortization: 720, labor: 4000, waste: 200, total: 7010, incomplete: true });
    expect(sumCosts([]).total).toBe(0);
    expect(averageCostPerGram([{ cost: 20000, net_grams: 1000 }, { cost: 30000, net_grams: 1000 }])).toBe(25);
    expect(averageCostPerGram([])).toBeNull();
  });
});

describe("calibrationFactor", () => {
  const s = (ratio: number) => ({ actual: ratio * 100, raw: 100 });

  it("con menos de 3 muestras → 1", () => {
    expect(calibrationFactor([])).toBe(1);
    expect(calibrationFactor([s(1.3), s(1.4)])).toBe(1);
    // Las de raw 0 no cuentan.
    expect(calibrationFactor([s(1.3), s(1.4), { actual: 50, raw: 0 }])).toBe(1);
  });

  it("mediana impar y par", () => {
    expect(calibrationFactor([s(1.1), s(1.2), s(0.9)])).toBe(1.1);
    expect(calibrationFactor([s(1.1), s(1.2), s(0.9), s(1.0)])).toBe(1.05);
  });

  it("acotada a [0,5; 2]", () => {
    expect(calibrationFactor([s(3), s(3), s(3)])).toBe(2);
    expect(calibrationFactor([s(0.1), s(0.2), s(0.3)])).toBe(0.5);
  });

  it("sólo las primeras 20", () => {
    const recent = Array.from({ length: 20 }, () => s(1.2));
    const old = Array.from({ length: 30 }, () => s(0.8));
    expect(calibrationFactor([...recent, ...old])).toBe(1.2);
  });
});
