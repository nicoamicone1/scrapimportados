/**
 * Schemas zod de la configuración del Taller 3D (compartidos entre los
 * formularios y las server actions). Los números aceptan string con coma
 * decimal ("0,28") porque los inputs los mandan así.
 */
import { z } from "zod";

import { MATERIAL_TYPES, type MaterialType } from "@/lib/print3d/types";

import { PRINTER_STATUSES, type PrinterStatus } from "./presets";

function toNumber(v: unknown): unknown {
  if (typeof v === "string") {
    const t = v.trim().replace(/\s/g, "");
    if (t === "") return undefined;
    return Number(t.replace(",", "."));
  }
  return v;
}

interface NumOpts {
  min: number;
  max: number;
  int?: boolean;
  /** Mensaje si falta o no es número. */
  label: string;
}

const num = ({ min, max, int, label }: NumOpts) => {
  let n = z
    .number({ required_error: `Ingresá ${label}.`, invalid_type_error: `Ingresá ${label}.` })
    .finite(`Ingresá ${label}.`)
    .min(min, min === 0 ? "No puede ser negativo." : `Tiene que ser ${min} o más.`)
    .max(max, `Como máximo ${max}.`);
  if (int) n = n.int("Tiene que ser un número entero.");
  return z.preprocess(toNumber, n);
};

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
    z.string().max(max, `Como máximo ${max} caracteres.`).nullable(),
  );

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const hex = z
  .string()
  .trim()
  .regex(HEX_RE, "Elegí un color válido (#RRGGBB).")
  .transform((h) => h.toUpperCase());

export const idSchema = z.string().uuid("Id inválido.");
const nullableId = z.preprocess((v) => (v === "" || v === undefined ? null : v), idSchema.nullable());

const materialType = z.enum(MATERIAL_TYPES as unknown as [MaterialType, ...MaterialType[]], {
  errorMap: () => ({ message: "Elegí un tipo de material." }),
});

/* ─────────────────────────── Impresoras ─────────────────────────── */

export const printerSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre (ej. «A1 de la ventana»).").max(60, "Como máximo 60 caracteres."),
  brand: optionalText(40),
  model: optionalText(60),
  bed_x: num({ min: 10, max: 2000, label: "el ancho de la cama" }),
  bed_y: num({ min: 10, max: 2000, label: "el fondo de la cama" }),
  bed_z: num({ min: 10, max: 2000, label: "la altura máxima" }),
  nozzle_mm: num({ min: 0.1, max: 2, label: "el diámetro de la boquilla" }),
  materials: z.array(materialType).min(1, "Marcá al menos un material que pueda imprimir."),
  watts: num({ min: 0, max: 5000, label: "el consumo" }),
  purchase_price: num({ min: 0, max: 999_999_999, label: "lo que te costó" }),
  lifetime_hours: num({ min: 100, max: 200_000, int: true, label: "la vida útil" }),
  hours_used: num({ min: 0, max: 9_999_999, label: "las horas usadas" }),
  status: z.enum(PRINTER_STATUSES as unknown as [PrinterStatus, ...PrinterStatus[]]),
  color: hex,
  notes: optionalText(1000),
});
export type PrinterValues = z.infer<typeof printerSchema>;

/* ─────────────────────────── Materiales y colores ─────────────────────────── */

export const colorInputSchema = z.object({
  id: nullableId,
  name: z.string().trim().min(1, "Poné el nombre del color.").max(40, "Como máximo 40 caracteres."),
  hex,
  is_active: z.boolean().default(true),
});

export const materialSchema = z
  .object({
    type: materialType,
    name: z.string().trim().min(1, "Poné un nombre (ej. «PLA Grilon3»).").max(60, "Como máximo 60 caracteres."),
    brand: optionalText(40),
    density: num({ min: 0.5, max: 3, label: "la densidad" }),
    price_per_gram: num({ min: 0.01, max: 1_000_000, label: "el precio por gramo" }),
    speed_factor: num({ min: 0.1, max: 3, label: "el factor de velocidad" }),
    is_active: z.boolean().default(true),
    colors: z.array(colorInputSchema).max(60, "Como máximo 60 colores por material."),
  })
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    m.colors.forEach((c, i) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["colors", i, "name"], message: "Ese color ya está en la lista." });
      }
      seen.add(key);
    });
  });
export type MaterialValues = z.infer<typeof materialSchema>;

/* ─────────────────────────── Bobinas ─────────────────────────── */

const isoDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.")
    .nullable(),
);

export const addSpoolsSchema = z.object({
  color_id: idSchema,
  count: num({ min: 1, max: 50, int: true, label: "cuántas bobinas" }),
  brand: optionalText(40),
  net_grams: num({ min: 1, max: 20_000, int: true, label: "los gramos netos" }),
  cost: num({ min: 0, max: 99_999_999, label: "el costo de cada bobina" }),
  purchased_at: isoDate,
  notes: optionalText(500),
});
export type AddSpoolsValues = z.infer<typeof addSpoolsSchema>;

export const adjustSpoolSchema = z.object({
  id: idSchema,
  remaining_grams: num({ min: 0, max: 20_000, label: "los gramos que quedan" }),
  cost: num({ min: 0, max: 99_999_999, label: "el costo" }),
  brand: optionalText(40),
  notes: optionalText(500),
});
export type AdjustSpoolValues = z.infer<typeof adjustSpoolSchema>;

/* ─────────────────────────── Configuración + calidades ─────────────────────────── */

export const settingsSchema = z.object({
  enabled: z.boolean(),
  hour_rate: num({ min: 0, max: 9_999_999, label: "el precio de la hora" }),
  min_piece_price: num({ min: 0, max: 9_999_999, label: "el mínimo por pieza" }),
  min_order_price: num({ min: 0, max: 99_999_999, label: "el mínimo por pedido" }),
  setup_fee: num({ min: 0, max: 9_999_999, label: "el cargo de preparación" }),
  post_process_fee: num({ min: 0, max: 9_999_999, label: "el post-proceso por pieza" }),
  support_extra_pct: num({ min: 0, max: 300, label: "el extra por soportes" }),
  round_to: num({ min: 0, max: 100_000, label: "el redondeo" }),
  max_auto_hours: num({ min: 0.5, max: 999, label: "las horas máximas" }),
  max_file_mb: num({ min: 1, max: 100, int: true, label: "el tamaño máximo" }),
  quote_valid_days: num({ min: 1, max: 90, int: true, label: "los días de validez" }),
  kwh_price: num({ min: 0, max: 999_999, label: "el precio del kWh" }),
  labor_hour_cost: num({ min: 0, max: 9_999_999, label: "el costo de la hora" }),
  daily_print_hours: num({ min: 1, max: 24, label: "las horas por día" }),
  post_process_days: num({ min: 0, max: 60, int: true, label: "los días de post-proceso" }),
  buffer_days: num({ min: 0, max: 60, int: true, label: "los días de colchón" }),
  working_days: z
    .array(z.number().int().min(1).max(7))
    .min(1, "Marcá al menos un día de despacho.")
    .transform((d) => Array.from(new Set(d)).sort((a, b) => a - b)),
  intro_md: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(4000, "Como máximo 4000 caracteres.")),
});
export type SettingsValues = z.infer<typeof settingsSchema>;

export const qualityInputSchema = z.object({
  id: nullableId,
  code: z
    .string()
    .trim()
    .min(1, "Falta el código.")
    .max(30, "Como máximo 30 caracteres.")
    .regex(/^[a-z0-9_-]+$/, "Sólo minúsculas, números y guiones."),
  name: z.string().trim().min(1, "Poné un nombre.").max(40, "Como máximo 40 caracteres."),
  layer_height: num({ min: 0.04, max: 1, label: "la altura de capa" }),
  wall_mm: num({ min: 0.2, max: 10, label: "el espesor de paredes" }),
  throughput_g_h: num({ min: 0.5, max: 999, label: "los gramos por hora" }),
  price_multiplier: num({ min: 0.1, max: 10, label: "el multiplicador" }),
  is_active: z.boolean().default(true),
});
export type QualityValues = z.infer<typeof qualityInputSchema>;

export const workshopConfigSchema = z
  .object({
    settings: settingsSchema,
    qualities: z.array(qualityInputSchema).max(20, "Como máximo 20 calidades."),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.qualities.forEach((q, i) => {
      if (seen.has(q.code)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["qualities", i, "name"], message: "Hay dos calidades con el mismo código." });
      }
      seen.add(q.code);
    });
  });
export type WorkshopConfigValues = z.infer<typeof workshopConfigSchema>;

export const calibrationKeySchema = z.object({ material_id: idSchema, quality_id: idSchema });

/* ─────────────────────────── Productos que se imprimen ─────────────────────────── */

export const productSpecSchema = z.object({
  id: nullableId,
  product_id: idSchema,
  variant_id: nullableId,
  material_id: idSchema,
  color_id: nullableId,
  quality_id: idSchema,
  grams_per_unit: num({ min: 0.1, max: 99_999, label: "los gramos por unidad" }),
  minutes_per_unit: num({ min: 0.1, max: 99_999, label: "los minutos por unidad" }),
  units_per_plate: num({ min: 1, max: 500, int: true, label: "las piezas por plato" }),
  post_minutes: num({ min: 0, max: 9_999, label: "los minutos de post-proceso" }),
  made_to_order: z.boolean(),
});
export type ProductSpecValues = z.infer<typeof productSpecSchema>;
