import type { MaterialType } from "@/lib/print3d/types";

/*
 * Datos fijos del taller (puros, sirven en cliente y server): presets de
 * impresoras, densidades típicas, tintas para las tarjetas y etiquetas.
 */

export interface PrinterPreset {
  id: string;
  brand: string;
  model: string;
  bed: [number, number, number];
  watts: number;
  materials: MaterialType[];
}

/** Modelos comunes (TALLER-3D §5): autocompletan cama y consumo. */
export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: "bambu-a1", brand: "Bambu Lab", model: "A1", bed: [256, 256, 256], watts: 95, materials: ["PLA", "PETG", "TPU"] },
  { id: "bambu-a1-mini", brand: "Bambu Lab", model: "A1 mini", bed: [180, 180, 180], watts: 80, materials: ["PLA", "PETG", "TPU"] },
  { id: "bambu-p1s", brand: "Bambu Lab", model: "P1S", bed: [256, 256, 256], watts: 130, materials: ["PLA", "PETG", "ABS", "ASA", "TPU"] },
  { id: "bambu-x1c", brand: "Bambu Lab", model: "X1C", bed: [256, 256, 256], watts: 140, materials: ["PLA", "PETG", "ABS", "ASA", "TPU", "NYLON", "PC"] },
  { id: "ender-3-v3", brand: "Creality", model: "Ender 3 V3", bed: [220, 220, 250], watts: 120, materials: ["PLA", "PETG", "TPU"] },
  { id: "creality-k1", brand: "Creality", model: "K1", bed: [220, 220, 220], watts: 150, materials: ["PLA", "PETG", "ABS", "TPU"] },
  { id: "creality-k1-max", brand: "Creality", model: "K1 Max", bed: [300, 300, 300], watts: 200, materials: ["PLA", "PETG", "ABS", "ASA", "TPU"] },
  { id: "prusa-mk4", brand: "Prusa", model: "MK4", bed: [250, 210, 220], watts: 100, materials: ["PLA", "PETG", "ASA", "TPU"] },
  { id: "prusa-mini", brand: "Prusa", model: "Mini+", bed: [180, 180, 180], watts: 80, materials: ["PLA", "PETG", "TPU"] },
  { id: "kobra-3", brand: "Anycubic", model: "Kobra 3", bed: [250, 250, 250], watts: 120, materials: ["PLA", "PETG", "TPU"] },
];

/**
 * Tintas para identificar cada impresora en la cola (todas ≥ 4,5:1 con texto
 * blanco). Derivadas de la paleta del panel (BRAND §5): pomelo-ink, tinta,
 * azul, petróleo, magenta, violeta, verde y ámbar oscuros.
 */
export const PRINTER_TINTS = ["#B02C14", "#10162F", "#2238D9", "#0B6366", "#A01C64", "#5B2E9E", "#17683F", "#8A4B00"] as const;

export const PRINTER_STATUSES = ["active", "maintenance", "inactive"] as const;
export type PrinterStatus = (typeof PRINTER_STATUSES)[number];

export const PRINTER_STATUS_LABELS: Record<PrinterStatus, string> = {
  active: "Activa",
  maintenance: "Mantenimiento",
  inactive: "Inactiva",
};

export const SPOOL_STATUSES = ["sealed", "open", "empty"] as const;
export type SpoolStatus = (typeof SPOOL_STATUSES)[number];

export const SPOOL_STATUS_LABELS: Record<SpoolStatus, string> = {
  sealed: "Cerrada",
  open: "Abierta",
  empty: "Vacía",
};

/** Densidad (g/cm³) y factor de velocidad típicos por tipo, para autocompletar. */
export const MATERIAL_DEFAULTS: Record<MaterialType, { density: number; speed_factor: number; hint: string }> = {
  PLA: { density: 1.24, speed_factor: 1, hint: "El de todos los días: fácil, rígido, poco warping." },
  PETG: { density: 1.27, speed_factor: 0.9, hint: "Más resistente al calor y a golpes; hila un poco." },
  ABS: { density: 1.04, speed_factor: 0.9, hint: "Pide cama caliente y cerramiento: warping." },
  ASA: { density: 1.07, speed_factor: 0.9, hint: "Como el ABS pero aguanta sol y exterior." },
  TPU: { density: 1.21, speed_factor: 0.5, hint: "Flexible: se imprime lento." },
  NYLON: { density: 1.14, speed_factor: 0.8, hint: "Muy tenaz; absorbe humedad, secalo antes." },
  PC: { density: 1.2, speed_factor: 0.8, hint: "Policarbonato: alta temperatura." },
  OTRO: { density: 1.24, speed_factor: 1, hint: "Cargá la densidad del fabricante." },
};

/** Colores de filamento habituales (swatches rápidos al crear colores). */
export const COMMON_FILAMENT_COLORS: { name: string; hex: string }[] = [
  { name: "Negro", hex: "#1D1D1F" },
  { name: "Blanco", hex: "#F4F3EE" },
  { name: "Gris", hex: "#8A8D91" },
  { name: "Rojo", hex: "#C8102E" },
  { name: "Azul", hex: "#1F4E9C" },
  { name: "Verde", hex: "#2E7D32" },
  { name: "Amarillo", hex: "#F2C200" },
  { name: "Naranja", hex: "#F26B1D" },
  { name: "Rosa", hex: "#E78FB3" },
  { name: "Violeta", hex: "#6A3FA0" },
  { name: "Transparente", hex: "#DCE6E8" },
  { name: "Madera", hex: "#A47148" },
];

/** Días ISO (1 = lunes … 7 = domingo). */
export const WEEK_DAYS: { iso: number; short: string; long: string }[] = [
  { iso: 1, short: "L", long: "Lunes" },
  { iso: 2, short: "M", long: "Martes" },
  { iso: 3, short: "X", long: "Miércoles" },
  { iso: 4, short: "J", long: "Jueves" },
  { iso: 5, short: "V", long: "Viernes" },
  { iso: 6, short: "S", long: "Sábado" },
  { iso: 7, short: "D", long: "Domingo" },
];

/** Umbral de "Stock bajo" por color, sumando bobinas (TALLER-3D §5). */
export const LOW_STOCK_GRAMS = 250;
