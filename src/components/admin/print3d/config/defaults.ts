import type { MaterialType } from "@/lib/print3d/types";

/*
 * Valores por defecto del taller (espejo de los defaults de
 * `print3d_settings` en la migración 0022) y el set de ejemplo que carga
 * `seedPrint3dDefaults`. Precios en ARS de 2026.
 */

export interface Print3dSettings {
  enabled: boolean;
  hour_rate: number;
  min_piece_price: number;
  min_order_price: number;
  setup_fee: number;
  post_process_fee: number;
  support_extra_pct: number;
  round_to: number;
  max_auto_hours: number;
  max_file_mb: number;
  quote_valid_days: number;
  kwh_price: number;
  labor_hour_cost: number;
  daily_print_hours: number;
  post_process_days: number;
  buffer_days: number;
  working_days: number[];
  intro_md: string;
}

export const DEFAULT_PRINT3D_SETTINGS: Print3dSettings = {
  enabled: true,
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
  kwh_price: 150,
  labor_hour_cost: 4000,
  daily_print_hours: 18,
  post_process_days: 1,
  buffer_days: 0,
  working_days: [1, 2, 3, 4, 5],
  intro_md: "",
};

export interface SeedQuality {
  code: string;
  name: string;
  layer_height: number;
  wall_mm: number;
  throughput_g_h: number;
  price_multiplier: number;
}

/**
 * Caudal efectivo (g/h) de una Bambu A1 / Ender 3 V3 con PLA, promediando
 * piezas chicas y grandes: la calibración lo ajusta con los trabajos reales.
 */
export const SEED_QUALITIES: SeedQuality[] = [
  { code: "draft", name: "Borrador 0,28", layer_height: 0.28, wall_mm: 0.9, throughput_g_h: 22, price_multiplier: 0.9 },
  { code: "standard", name: "Estándar 0,20", layer_height: 0.2, wall_mm: 1.2, throughput_g_h: 15, price_multiplier: 1 },
  { code: "fine", name: "Fina 0,12", layer_height: 0.12, wall_mm: 1.2, throughput_g_h: 8, price_multiplier: 1.25 },
];

export interface SeedMaterial {
  type: MaterialType;
  name: string;
  brand: string | null;
  density: number;
  /** Precio de VENTA por gramo (bobina de 1 kg ≈ $ 26.000–38.000 en 2026, × ~2,5–3). */
  price_per_gram: number;
  speed_factor: number;
  colors: { name: string; hex: string }[];
}

export const SEED_MATERIALS: SeedMaterial[] = [
  {
    type: "PLA",
    name: "PLA",
    brand: null,
    density: 1.24,
    price_per_gram: 75,
    speed_factor: 1,
    colors: [
      { name: "Negro", hex: "#1D1D1F" },
      { name: "Blanco", hex: "#F4F3EE" },
      { name: "Gris", hex: "#8A8D91" },
      { name: "Rojo", hex: "#C8102E" },
      { name: "Azul", hex: "#1F4E9C" },
      { name: "Verde", hex: "#2E7D32" },
      { name: "Amarillo", hex: "#F2C200" },
      { name: "Naranja", hex: "#F26B1D" },
    ],
  },
  {
    type: "PETG",
    name: "PETG",
    brand: null,
    density: 1.27,
    price_per_gram: 85,
    speed_factor: 0.9,
    colors: [
      { name: "Negro", hex: "#1D1D1F" },
      { name: "Blanco", hex: "#F4F3EE" },
      { name: "Transparente", hex: "#DCE6E8" },
      { name: "Gris", hex: "#8A8D91" },
    ],
  },
  {
    type: "TPU",
    name: "TPU 95A",
    brand: null,
    density: 1.21,
    price_per_gram: 130,
    speed_factor: 0.5,
    colors: [
      { name: "Negro", hex: "#1D1D1F" },
      { name: "Transparente", hex: "#DCE6E8" },
    ],
  },
];

export const SEED_PRINTER = {
  name: "Bambu Lab A1",
  brand: "Bambu Lab",
  model: "A1",
  bed_x: 256,
  bed_y: 256,
  bed_z: 256,
  nozzle_mm: 0.4,
  materials: ["PLA", "PETG", "TPU"] as MaterialType[],
  watts: 95,
  purchase_price: 950_000,
  lifetime_hours: 5000,
  hours_used: 0,
  status: "active" as const,
  color: "#E86A33",
};
