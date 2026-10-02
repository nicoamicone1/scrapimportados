import { describe, expect, it } from "vitest";

import {
  compareGeometry,
  costInputsFor,
  costPerGramFor,
  dueState,
  formatMinutes,
  formatYmdShort,
  parseGeometry,
  plateJobsForItem,
  printProgress,
  remainingMinutes,
  specForItem,
  suggestAssignments,
  todayYmd,
  type SpecLike,
} from "./print3d-production-utils";

const cube = { volume_mm3: 8000, area_mm2: 2400, bbox: [20, 20, 20] as [number, number, number], triangles: 12, manifold: true };

describe("tiempos", () => {
  it("formatea minutos", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(200)).toBe("3 h 20 min");
    expect(formatMinutes(null)).toBe("—");
  });

  it("restante de un trabajo imprimiendo nunca es negativo", () => {
    const now = new Date("2026-09-29T15:00:00Z");
    const started = "2026-09-29T14:00:00Z";
    expect(remainingMinutes({ status: "printing", est_minutes: 180, started_at: started }, now)).toBe(120);
    expect(remainingMinutes({ status: "printing", est_minutes: 30, started_at: started }, now)).toBe(0);
    expect(remainingMinutes({ status: "queued", est_minutes: 90, started_at: null }, now)).toBe(90);
    expect(remainingMinutes({ status: "done", est_minutes: 90, started_at: started }, now)).toBe(0);
    expect(printProgress({ status: "printing", est_minutes: 120, started_at: started }, now)).toBeCloseTo(0.5);
  });

  it("fecha de hoy en la zona de la tienda", () => {
    // 01:30 UTC = 22:30 del día anterior en Buenos Aires.
    expect(todayYmd("America/Argentina/Buenos_Aires", new Date("2026-09-30T01:30:00Z"))).toBe("2026-09-29");
  });

  it("estado de la fecha comprometida", () => {
    expect(dueState("2026-09-28", "2026-09-29")).toBe("overdue");
    expect(dueState("2026-09-29", "2026-09-29")).toBe("today");
    expect(dueState("2026-10-01", "2026-09-29")).toBe("soon");
    expect(dueState("2026-10-10", "2026-09-29")).toBe("ok");
    expect(dueState("2026-09-01", "2026-09-29", "done")).toBe("ok");
    expect(dueState(null, "2026-09-29")).toBe("none");
    expect(formatYmdShort("2026-10-08")).toMatch(/8 oct/);
  });
});

describe("sugerir asignación (greedy)", () => {
  const printers = [
    { id: "a1", bed: [256, 256, 256] as [number, number, number], materials: ["PLA", "PETG"], backlog_minutes: 0 },
    { id: "mini", bed: [180, 180, 180] as [number, number, number], materials: ["PLA"], backlog_minutes: 60 },
  ];

  it("reparte de mayor a menor en la de menos carga", () => {
    const s = suggestAssignments(printers, [
      { id: "j1", minutes: 300, material_type: "PLA", bbox: [50, 50, 50] },
      { id: "j2", minutes: 120, material_type: "PLA", bbox: [50, 50, 50] },
      { id: "j3", minutes: 100, material_type: "PLA", bbox: [50, 50, 50] },
    ]);
    // j1 → a1 (0 < 60); j2 → mini (60 < 300); j3 → mini (180 < 300).
    expect(s.assignments).toEqual([
      { jobId: "j1", printerId: "a1" },
      { jobId: "j2", printerId: "mini" },
      { jobId: "j3", printerId: "mini" },
    ]);
    expect(s.loads).toEqual({ a1: 300, mini: 280 });
  });

  it("respeta material y tamaño de cama", () => {
    const s = suggestAssignments(printers, [
      { id: "petg", minutes: 10, material_type: "PETG", bbox: null },
      { id: "big", minutes: 10, material_type: "PLA", bbox: [200, 200, 100] },
      { id: "tpu", minutes: 10, material_type: "TPU", bbox: null },
      { id: "huge", minutes: 10, material_type: "PLA", bbox: [400, 20, 20] },
    ]);
    expect(s.assignments.find((a) => a.jobId === "petg")?.printerId).toBe("a1");
    expect(s.assignments.find((a) => a.jobId === "big")?.printerId).toBe("a1");
    expect(s.unplaceable.sort()).toEqual(["huge", "tpu"]);
  });
});

describe("pedido → trabajos por plato", () => {
  const spec: SpecLike = {
    product_id: "p1",
    variant_id: null,
    material_id: "pla",
    color_id: "negro",
    quality_id: "std",
    grams_per_unit: 12.5,
    minutes_per_unit: 40,
    units_per_plate: 4,
    post_minutes: 2,
  };

  it("agrupa por piezas por plato", () => {
    const jobs = plateJobsForItem({ id: "i1", product_id: "p1", variant_id: null, name: "Maceta", variant_title: "Chica", qty: 10 }, spec);
    expect(jobs.map((j) => j.qty)).toEqual([4, 4, 2]);
    expect(jobs[0].title).toBe("Maceta · Chica (plato 1 de 3)");
    expect(jobs[2].est_grams).toBe(25);
    expect(jobs[2].est_minutes).toBe(80);
    expect(jobs[2].post_minutes).toBe(4);
  });

  it("un solo plato no lleva numeración", () => {
    const jobs = plateJobsForItem({ id: "i1", product_id: "p1", variant_id: null, name: "Llavero", variant_title: null, qty: 3 }, spec);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe("Llavero");
  });

  it("prefiere la spec de la variante", () => {
    const v = { ...spec, variant_id: "v2", grams_per_unit: 99 };
    expect(specForItem({ product_id: "p1", variant_id: "v2" }, [spec, v])?.grams_per_unit).toBe(99);
    expect(specForItem({ product_id: "p1", variant_id: "v3" }, [spec, v])?.grams_per_unit).toBe(12.5);
    expect(specForItem({ product_id: null, variant_id: null }, [spec])).toBeNull();
  });
});

describe("costeo", () => {
  const spools = [
    { id: "s1", color_id: "negro", cost: 20000, net_grams: 1000 },
    { id: "s2", color_id: "negro", cost: 30000, net_grams: 1000 },
    { id: "s3", color_id: "blanco", cost: 0, net_grams: 1000 },
  ];
  const colorMaterial = new Map([
    ["negro", "pla"],
    ["blanco", "pla"],
  ]);

  it("bobina → color → material → sin datos", () => {
    expect(costPerGramFor({ spool_id: "s1", color_id: "negro", material_id: "pla" }, spools, colorMaterial)).toBe(20);
    expect(costPerGramFor({ spool_id: null, color_id: "negro", material_id: "pla" }, spools, colorMaterial)).toBe(25);
    expect(costPerGramFor({ spool_id: "s3", color_id: "blanco", material_id: "pla" }, spools, colorMaterial)).toBe(25);
    expect(costPerGramFor({ spool_id: null, color_id: "rojo", material_id: "petg" }, spools, colorMaterial)).toBeNull();
  });

  it("usa reales si hay y sólo el desperdicio si falló", () => {
    const base = { est_grams: 100, est_minutes: 200, actual_grams: null, actual_minutes: null, wasted_grams: 0, post_minutes: 10 };
    expect(costInputsFor({ ...base, status: "queued" })).toEqual({ grams: 100, minutes: 200, wasted_grams: 0, post_minutes: 10 });
    expect(costInputsFor({ ...base, status: "done", actual_grams: 110, actual_minutes: 190 })?.grams).toBe(110);
    expect(costInputsFor({ ...base, status: "failed", actual_minutes: 50, wasted_grams: 40 })).toEqual({
      grams: 0,
      minutes: 50,
      wasted_grams: 40,
      post_minutes: 0,
    });
    expect(costInputsFor({ ...base, status: "cancelled" })).toBeNull();
  });
});

describe("verificación de geometría", () => {
  it("coincide sin escalar", () => {
    const r = compareGeometry(cube, cube);
    expect(r.matches).toBe(true);
    expect(r.scale).toBe(1);
  });

  it("detecta que el cliente la pasó de cm a mm", () => {
    const file = { ...cube, volume_mm3: 8, area_mm2: 24, bbox: [2, 2, 2] as [number, number, number] };
    const r = compareGeometry(cube, file);
    expect(r.matches).toBe(true);
    expect(r.unitHint).toBe("cm");
  });

  it("alerta si el volumen no cuadra más de 3 %", () => {
    const r = compareGeometry({ ...cube, volume_mm3: 7000 }, cube);
    expect(r.matches).toBe(false);
    expect(r.diffs.volume).toBeGreaterThan(0.03);
  });

  it("alerta si cambió la cantidad de triángulos", () => {
    expect(compareGeometry({ ...cube, triangles: 1200 }, cube).matches).toBe(false);
  });

  it("parsea el jsonb de geometría", () => {
    expect(parseGeometry(cube)).toEqual(cube);
    expect(parseGeometry({ bbox: [1, 2] })).toBeNull();
    expect(parseGeometry(null)).toBeNull();
  });
});
