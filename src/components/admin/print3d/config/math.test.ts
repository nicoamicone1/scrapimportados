import { describe, expect, it } from "vitest";

import type { PriceSettings, PublicMaterial, PublicQuality } from "@/lib/print3d/types";

import { DEFAULT_PRINT3D_SETTINGS, SEED_MATERIALS, SEED_QUALITIES } from "./defaults";
import {
  averageCostPerGram,
  estimateMinutes,
  machineHourCost,
  pickPrinterFor,
  simulatePiece,
  solidGeometryForGrams,
  spoolFill,
  suggestedPricePerGram,
} from "./math";
import { PRINTER_PRESETS } from "./presets";
import { materialSchema, qualityInputSchema, settingsSchema } from "./schemas";

const settings: PriceSettings = {
  hour_rate: 1500,
  min_piece_price: 1500,
  min_order_price: 5000,
  setup_fee: 0,
  post_process_fee: 0,
  support_extra_pct: 25,
  round_to: 100,
  max_auto_hours: 24,
};
const pla: PublicMaterial = { id: "m1", type: "PLA", name: "PLA", density: 1.24, price_per_gram: 75, speed_factor: 1, colors: [] };
const standard: PublicQuality = {
  id: "q1",
  code: "standard",
  name: "Estándar 0,20",
  layer_height: 0.2,
  wall_mm: 1.2,
  throughput_g_h: 15,
  price_multiplier: 1,
};

describe("simulador", () => {
  it("una pieza maciza de N gramos da N gramos crudos", () => {
    const g = solidGeometryForGrams(100, 1.24);
    expect(g.volume_mm3).toBeCloseTo(80645.16, 1);
    const sim = simulatePiece({ grams: 100, material: pla, quality: standard, settings, calibration: [] });
    expect(sim.raw_grams).toBeCloseTo(100, 6);
    expect(sim.grams).toBe(100);
    expect(sim.minutes).toBe(400);
  });

  it("100 g de PLA estándar: 7.500 de material + 10.000 de máquina → $ 17.500", () => {
    const sim = simulatePiece({ grams: 100, material: pla, quality: standard, settings, calibration: [] });
    expect(sim.materialPart).toBe(7500);
    expect(sim.machinePart).toBe(10000);
    expect(sim.unit_price).toBe(17500);
    expect(sim.hitMinimum).toBe(false);
  });

  it("aplica la calibración y el mínimo por pieza", () => {
    const sim = simulatePiece({
      grams: 5,
      material: pla,
      quality: standard,
      settings,
      calibration: [{ material_id: "m1", quality_id: "q1", grams_factor: 1.1, time_factor: 1.2, samples: 5 }],
    });
    expect(sim.grams).toBe(5.5);
    expect(sim.minutes).toBe(24);
    expect(sim.unit_price).toBe(1500);
    expect(sim.hitMinimum).toBe(true);
  });
});

describe("costos", () => {
  it("hora-máquina de una A1: luz + amortización", () => {
    const h = machineHourCost({ watts: 95, purchase_price: 950_000, lifetime_hours: 5000 }, 150);
    expect(h.energy).toBe(14.25);
    expect(h.amortization).toBe(190);
    expect(h.total).toBe(204.25);
  });

  it("costo promedio ponderado por gramos, ignorando bobinas sin costo", () => {
    expect(
      averageCostPerGram([
        { cost: 26000, net_grams: 1000 },
        { cost: 15000, net_grams: 500 },
        { cost: 0, net_grams: 1000 },
      ]),
    ).toBeCloseTo(41000 / 1500, 6);
    expect(averageCostPerGram([{ cost: 0, net_grams: 1000 }])).toBeNull();
  });

  it("sugerencia de precio: costo × margen redondeado a $ 0,50", () => {
    expect(suggestedPricePerGram(26, 3)).toBe(78);
    expect(suggestedPricePerGram(24.1, 2.5)).toBe(60.5);
  });

  it("elige una impresora activa que imprima el material", () => {
    const printers = [
      { name: "Vieja", status: "inactive", materials: ["PLA", "TPU"] },
      { name: "A1 mini", status: "active", materials: ["PLA"] },
      { name: "P1S", status: "active", materials: ["PLA", "TPU"] },
    ];
    expect(pickPrinterFor(printers, "TPU")?.name).toBe("P1S");
    expect(pickPrinterFor(printers, "ABS")?.name).toBe("A1 mini");
    expect(pickPrinterFor([], "PLA")).toBeNull();
  });
});

describe("bobinas y tiempos", () => {
  it("barra de la bobina acotada a 0..1", () => {
    expect(spoolFill(250, 1000)).toBe(0.25);
    expect(spoolFill(-5, 1000)).toBe(0);
    expect(spoolFill(1200, 1000)).toBe(1);
    expect(spoolFill(10, 0)).toBe(0);
  });

  it("estima minutos con caudal, velocidad del material y calibración", () => {
    expect(estimateMinutes(30, { throughput_g_h: 15 }, { speed_factor: 1 })).toBe(120);
    expect(estimateMinutes(30, { throughput_g_h: 15 }, { speed_factor: 0.5 })).toBe(240);
    expect(estimateMinutes(30, { throughput_g_h: 15 }, { speed_factor: 1 }, 1.1)).toBe(132);
  });
});

describe("schemas y datos de ejemplo", () => {
  it("acepta coma decimal y ordena los días", () => {
    const parsed = settingsSchema.parse({
      ...DEFAULT_PRINT3D_SETTINGS,
      hour_rate: "1.500".replace(".", ""),
      daily_print_hours: "18,5",
      working_days: [5, 1, 3, 1],
    });
    expect(parsed.hour_rate).toBe(1500);
    expect(parsed.daily_print_hours).toBe(18.5);
    expect(parsed.working_days).toEqual([1, 3, 5]);
  });

  it("las calidades y materiales de ejemplo pasan la validación", () => {
    for (const q of SEED_QUALITIES) expect(qualityInputSchema.safeParse({ ...q, id: null, is_active: true }).success).toBe(true);
    for (const m of SEED_MATERIALS) {
      const res = materialSchema.safeParse({ ...m, is_active: true, colors: m.colors.map((c) => ({ ...c, id: null, is_active: true })) });
      expect(res.success).toBe(true);
    }
  });

  it("rechaza colores repetidos en un material", () => {
    const res = materialSchema.safeParse({
      ...SEED_MATERIALS[0],
      is_active: true,
      colors: [
        { id: null, name: "Negro", hex: "#000000" },
        { id: null, name: "negro", hex: "#111111" },
      ],
    });
    expect(res.success).toBe(false);
  });

  it("los presets de impresoras tienen cama y consumo", () => {
    expect(PRINTER_PRESETS).toHaveLength(10);
    for (const p of PRINTER_PRESETS) {
      expect(p.bed.every((v) => v > 0)).toBe(true);
      expect(p.watts).toBeGreaterThan(0);
    }
  });
});
