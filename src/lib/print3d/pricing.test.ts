import { describe, expect, it } from "vitest";

import { fitsPrinter, geometryIsPlausible } from "./geometry";
import { calibrationFor, ceilTo, priceItem, quoteTotals, REVIEW_REASON_LABELS, reviewReasons } from "./pricing";
import { round2, roundTo } from "./round";
import type { Calibration, Geometry, ItemChoice, PriceSettings, PrinterCapacity, PublicColor, PublicMaterial, PublicQuality } from "./types";
import { REVIEW_REASONS } from "./types";

const CUBE: Geometry = { volume_mm3: 8000, area_mm2: 2400, bbox: [20, 20, 20], triangles: 12, manifold: true };

const SETTINGS: PriceSettings = {
  hour_rate: 1500,
  min_piece_price: 1500,
  min_order_price: 5000,
  setup_fee: 0,
  post_process_fee: 0,
  support_extra_pct: 25,
  round_to: 100,
  max_auto_hours: 24,
};

const NEGRO: PublicColor = { id: "negro", name: "Negro", hex: "#111111", available_grams: 1000 };
const PLA: PublicMaterial = { id: "pla", type: "PLA", name: "PLA Grilon3", density: 1.24, price_per_gram: 20, speed_factor: 1, colors: [NEGRO] };
const STD: PublicQuality = { id: "std", code: "standard", name: "Estándar 0,20", layer_height: 0.2, wall_mm: 1.2, throughput_g_h: 12, price_multiplier: 1 };
const CAL: Calibration[] = [{ material_id: "pla", quality_id: "std", grams_factor: 1.1, time_factor: 1.2, samples: 5 }];

const choice = (over: Partial<ItemChoice> = {}): ItemChoice => ({
  material_id: "pla",
  color_id: "negro",
  quality_id: "std",
  infill_pct: 20,
  supports: false,
  qty: 1,
  ...over,
});

describe("redondeos", () => {
  it("roundTo y round2 redondean como Postgres (mitad hacia afuera)", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(round2(1711.4249999999997)).toBe(1711.43);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(roundTo(4.84096, 2)).toBe(4.84);
  });

  it("ceilTo: múltiplo hacia arriba; r = 0 → centavos", () => {
    expect(ceilTo(1190.95, 100)).toBe(1200);
    expect(ceilTo(1200, 100)).toBe(1200);
    // Ruido binario de 40/60·1500 no salta al múltiplo siguiente.
    expect(ceilTo((40 / 60) * 1500, 100)).toBe(1000);
    expect(ceilTo(1.1, 0.1)).toBe(1.1);
    expect(ceilTo(1200.01, 100)).toBe(1300);
    expect(ceilTo(1190.951, 0)).toBe(1190.95);
    expect(ceilTo(1190.955, 0)).toBe(1190.96);
    expect(ceilTo(333.33, 50)).toBe(350);
  });
});

describe("priceItem", () => {
  it("cubo 20 mm, PLA estándar, 20 % sin soportes: gana el mínimo por pieza", () => {
    // shell = min(8000, 2400·1,2) = 2880; material = 2880 + 5120·0,2 = 3904 mm³
    // raw_grams = 3,904·1,24 = 4,84096 → 4,84; raw_min = 4,84096/12·60 = 24,2048 → 24,20
    // base = 4,84·20 + 24,2/60·1500 = 96,8 + 605 = 701,8 → mínimo 1500
    const est = priceItem(CUBE, choice({ qty: 3 }), { settings: SETTINGS, material: PLA, quality: STD, calibration: [] });
    expect(est).toEqual({ raw_grams: 4.84, raw_minutes: 24.2, grams: 4.84, minutes: 24.2, unit_price: 1500, total: 4500 });
  });

  it("con soportes, calibración, post-proceso y multiplicador", () => {
    // material = 3904·1,25 = 4880 → raw_grams = 6,0512 → 6,05; raw_min = 30,256 → 30,26
    // grams = 6,0512·1,1 = 6,65632 → 6,66; minutes = 30,256·1,2 = 36,3072 → 36,31
    // base = (6,66·20 + 36,31/60·1500)·1,5 + 150 = (133,2 + 907,75)·1,5 + 150 = 1711,425
    const settings = { ...SETTINGS, min_piece_price: 500, post_process_fee: 150 };
    const quality = { ...STD, price_multiplier: 1.5 };
    const ctx = { settings, material: PLA, quality, calibration: CAL };
    const est = priceItem(CUBE, choice({ supports: true, qty: 2 }), ctx);
    expect(est).toEqual({ raw_grams: 6.05, raw_minutes: 30.26, grams: 6.66, minutes: 36.31, unit_price: 1800, total: 3600 });
    // Sin redondeo (round_to = 0): a centavos, 1711,425 → 1711,43.
    const cents = priceItem(CUBE, choice({ supports: true, qty: 2 }), { ...ctx, settings: { ...settings, round_to: 0 } });
    expect(cents.unit_price).toBe(1711.43);
    expect(cents.total).toBe(3422.86);
  });

  it("relleno 100 % = todo el volumen; speed_factor alarga el tiempo", () => {
    const tpu = { ...PLA, id: "tpu", type: "TPU" as const, speed_factor: 0.5 };
    const est = priceItem(CUBE, choice({ infill_pct: 100 }), { settings: SETTINGS, material: tpu, quality: STD, calibration: [] });
    // 8 cm³ · 1,24 = 9,92 g; 9,92 / (12·0,5) · 60 = 99,2 min
    expect(est.raw_grams).toBe(9.92);
    expect(est.raw_minutes).toBe(99.2);
    // 9,92·20 + 99,2/60·1500 = 198,4 + 2480 = 2678,4 → 2700
    expect(est.unit_price).toBe(2700);
  });

  it("calibrationFor: sin fila = 1", () => {
    expect(calibrationFor(CAL, "pla", "std")).toEqual({ grams_factor: 1.1, time_factor: 1.2 });
    expect(calibrationFor(CAL, "pla", "fina")).toEqual({ grams_factor: 1, time_factor: 1 });
  });
});

describe("quoteTotals", () => {
  it("ajusta hasta el pedido mínimo", () => {
    expect(quoteTotals([1500, 1800], { ...SETTINGS, setup_fee: 500 })).toEqual({ subtotal: 3300, setup_fee: 500, min_adjustment: 1200, total: 5000 });
  });
  it("sin ajuste si ya supera el mínimo", () => {
    expect(quoteTotals([4500, 3600], SETTINGS)).toEqual({ subtotal: 8100, setup_fee: 0, min_adjustment: 0, total: 8100 });
  });
  it("sin líneas: todo en 0", () => {
    expect(quoteTotals([], SETTINGS)).toEqual({ subtotal: 0, setup_fee: 0, min_adjustment: 0, total: 0 });
  });
});

describe("geometría", () => {
  it("fitsPrinter prueba las rotaciones", () => {
    // 250 de largo no entra acostado en 220 × 220, pero sí parado (z = 250).
    expect(fitsPrinter([250, 100, 30], [220, 220, 250])).toBe(true);
    expect(fitsPrinter([230, 230, 10], [220, 220, 250])).toBe(false);
    expect(fitsPrinter([256, 256, 256], [256, 256, 256])).toBe(true);
  });

  it("geometryIsPlausible", () => {
    expect(geometryIsPlausible(CUBE)).toBe(true);
    expect(geometryIsPlausible({ ...CUBE, volume_mm3: 9000 })).toBe(false); // no entra en la caja
    expect(geometryIsPlausible({ ...CUBE, area_mm2: 1000 })).toBe(false); // menos área que una esfera
    expect(geometryIsPlausible({ ...CUBE, triangles: 3 })).toBe(false);
    expect(geometryIsPlausible({ ...CUBE, bbox: [2001, 20, 20] })).toBe(false);
    expect(geometryIsPlausible({ ...CUBE, volume_mm3: Number.NaN })).toBe(false);
    expect(geometryIsPlausible({ ...CUBE, bbox: [20, 0, 20] })).toBe(false);
  });
});

describe("reviewReasons", () => {
  const A1: PrinterCapacity = { id: "a1", bed: [256, 256, 256], materials: ["PLA", "PETG"], backlog_minutes: 0 };
  const ctx = { settings: SETTINGS, material: PLA, color: NEGRO, printers: [A1] };
  const est = priceItem(CUBE, choice(), { settings: SETTINGS, material: PLA, quality: STD, calibration: [] });

  it("pieza normal: sin motivos", () => {
    expect(reviewReasons(CUBE, choice(), est, ctx)).toEqual([]);
  });

  it("no entra / material que ninguna imprime", () => {
    const big = { ...CUBE, bbox: [300, 20, 20] as [number, number, number] };
    expect(reviewReasons(big, choice(), est, ctx)).toContain("no_fit");
    expect(reviewReasons(CUBE, choice(), est, { ...ctx, material: { ...PLA, type: "TPU" } })).toEqual(["no_fit"]);
    expect(reviewReasons(CUBE, choice(), est, { ...ctx, printers: [] })).toEqual(["no_fit"]);
  });

  it("muy larga, abierta, chica, sin stock e implausible (en orden)", () => {
    const g: Geometry = { volume_mm3: 30, area_mm2: 10, bbox: [5, 5, 5], triangles: 12, manifold: false };
    const long = { ...est, minutes: 24 * 60 + 1, grams: 100 };
    const reasons = reviewReasons(g, choice({ qty: 10 }), long, ctx);
    expect(reasons).toEqual(["too_long", "open_mesh", "too_small", "no_stock", "implausible"]);
  });

  it("stock: pide 10 % de margen", () => {
    const e = { ...est, grams: 100 };
    expect(reviewReasons(CUBE, choice({ qty: 9 }), e, { ...ctx, color: { ...NEGRO, available_grams: 990 } })).toEqual([]);
    expect(reviewReasons(CUBE, choice({ qty: 9 }), e, { ...ctx, color: { ...NEGRO, available_grams: 989.99 } })).toEqual(["no_stock"]);
  });

  it("todos los motivos tienen texto", () => {
    for (const r of REVIEW_REASONS) expect(REVIEW_REASON_LABELS[r].length).toBeGreaterThan(5);
  });
});
