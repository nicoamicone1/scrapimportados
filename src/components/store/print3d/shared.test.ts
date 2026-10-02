import { describe, expect, it } from "vitest";

import type { PublicConfig } from "@/lib/print3d/types";

import { defaultChoice, evaluatePiece, summarize } from "./evaluate";
import { describeChoice, formatDims, formatOf, formatPrintTime, formatReadyDate, safeFileStem } from "./shared";

describe("formatos del cotizador", () => {
  it("fecha pura sin correrse de día", () => {
    expect(formatReadyDate("2026-10-08")).toBe("jueves 8 de octubre");
    expect(formatReadyDate(null)).toBeNull();
    expect(formatReadyDate("8/10")).toBeNull();
  });
  it("horas de impresión", () => {
    expect(formatPrintTime(45)).toBe("45 min");
    expect(formatPrintTime(200)).toBe("3 h 20 min");
    expect(formatPrintTime(120)).toBe("2 h");
    expect(formatPrintTime(26 * 60 + 40)).toBe("27 h");
  });
  it("medidas, nombres y formatos", () => {
    expect(formatDims([120, 80.25, 4.5])).toBe("120 × 80,3 × 4,5 mm");
    expect(safeFileStem("Soporte cámara (v2) ñ.stl")).toBe("Soporte-camara-v2-n");
    expect(safeFileStem("...stl")).toBe("pieza");
    expect(formatOf("pieza.STL")).toBe("stl");
    expect(formatOf("placa.3mf")).toBe("3mf");
    expect(formatOf("pieza.obj")).toBeNull();
    expect(describeChoice({ materialName: "PLA", colorName: "Negro", qualityName: "Estándar 0,20", infillPct: 20, supports: true })).toBe(
      "PLA Negro · Estándar 0,20 · 20 % relleno · con soportes",
    );
  });
});

const config: PublicConfig = {
  settings: {
    hour_rate: 1500,
    min_piece_price: 1500,
    min_order_price: 5000,
    setup_fee: 0,
    post_process_fee: 0,
    support_extra_pct: 25,
    round_to: 100,
    max_auto_hours: 24,
    max_file_mb: 50,
    quote_valid_days: 7,
    daily_print_hours: 18,
    post_process_days: 1,
    buffer_days: 0,
    working_days: [1, 2, 3, 4, 5],
    intro_md: "",
  },
  materials: [
    { id: "m-tpu", type: "TPU", name: "TPU", density: 1.21, price_per_gram: 40, speed_factor: 0.5, colors: [{ id: "c-x", name: "Negro", hex: "#111111", available_grams: 0 }] },
    {
      id: "m-pla",
      type: "PLA",
      name: "PLA",
      density: 1.24,
      price_per_gram: 25,
      speed_factor: 1,
      colors: [
        { id: "c-sin", name: "Rojo", hex: "#cc0000", available_grams: 0 },
        { id: "c-ok", name: "Negro", hex: "#111111", available_grams: 900 },
      ],
    },
  ],
  qualities: [
    { id: "q-draft", code: "draft", name: "Borrador 0,28", layer_height: 0.28, wall_mm: 0.8, throughput_g_h: 20, price_multiplier: 0.9 },
    { id: "q-std", code: "standard", name: "Estándar 0,20", layer_height: 0.2, wall_mm: 1.2, throughput_g_h: 15, price_multiplier: 1 },
  ],
  calibration: [],
  printers: [{ id: "p1", bed: [256, 256, 256], materials: ["PLA", "PETG"], backlog_minutes: 0 }],
  made_to_order: [],
};

describe("cálculo en vivo", () => {
  it("elige material y color con stock y la calidad estándar", () => {
    expect(defaultChoice(config)).toEqual({ material_id: "m-pla", color_id: "c-ok", quality_id: "q-std", infill_pct: 20, supports: false, qty: 1 });
  });
  it("una pieza nueva hereda lo último elegido (con cantidad 1)", () => {
    const prev = { material_id: "m-pla", color_id: "c-sin", quality_id: "q-draft", infill_pct: 40, supports: true, qty: 5 };
    expect(defaultChoice(config, prev)).toEqual({ ...prev, qty: 1 });
  });
  it("escala unidades y marca revisión por stock", () => {
    const geometry = { volume_mm3: 8, area_mm2: 24, bbox: [2, 2, 2] as [number, number, number], triangles: 12, manifold: true };
    const choice = { material_id: "m-pla", color_id: "c-sin", quality_id: "q-std", infill_pct: 20, supports: false, qty: 2 };
    const ev = evaluatePiece({ geometry, unit: "cm", scalePct: 100, choice }, config)!;
    expect(ev.geometry.bbox).toEqual([20, 20, 20]);
    expect(ev.geometry.volume_mm3).toBeCloseTo(8000);
    expect(ev.reasons).toContain("no_stock");
    const sum = summarize([ev], [2], config, new Date("2026-10-05T12:00:00-03:00"));
    expect(sum.pieces).toBe(2);
    expect(sum.totals.total).toBeGreaterThanOrEqual(config.settings.min_order_price);
    expect(sum.ready?.date).toMatch(/^2026-10-\d{2}$/);
  });
});
