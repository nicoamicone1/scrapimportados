import { z } from "zod";

/** Todos los motivos de `inventory_movements.reason`. */
export const MOVEMENT_REASONS = ["sale", "cancel", "restock", "adjustment", "return", "import", "correction"] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  sale: "Venta",
  cancel: "Cancelación",
  restock: "Reposición",
  adjustment: "Ajuste",
  return: "Devolución",
  import: "Importación",
  correction: "Corrección",
};

/** Motivos que puede elegir el admin al ajustar a mano. */
export const MANUAL_REASONS = ["restock", "adjustment", "return", "correction"] as const;
export type ManualReason = (typeof MANUAL_REASONS)[number];

export const STOCK_STATE_LABELS = {
  ok: "En stock",
  low: "Stock bajo",
  out: "Agotado",
  untracked: "Sin seguimiento",
} as const;

export type StockState = keyof typeof STOCK_STATE_LABELS;

const note = z
  .string()
  .trim()
  .max(200, "Hasta 200 caracteres.")
  .nullish()
  .transform((v) => (v ? v : null));

/** `delta`: suma/resta N · `set`: deja el stock en N. */
export const adjustModeSchema = z.enum(["delta", "set"]);

const quantity = z
  .number({ invalid_type_error: "Ingresá un número entero." })
  .int("Tiene que ser un número entero.")
  .min(-999_999, "Es demasiado grande.")
  .max(999_999, "Es demasiado grande.");

export const adjustStockSchema = z
  .object({
    variantId: z.string().uuid(),
    mode: adjustModeSchema,
    value: quantity,
    reason: z.enum(MANUAL_REASONS),
    note,
  })
  .refine((d) => d.mode === "set" ? d.value >= 0 : d.value !== 0, {
    message: "Ingresá una cantidad distinta de 0.",
    path: ["value"],
  });

export const bulkAdjustStockSchema = z
  .object({
    variantIds: z.array(z.string().uuid()).min(1, "Elegí al menos una variante.").max(500, "Hasta 500 variantes por vez."),
    mode: adjustModeSchema,
    value: quantity,
    reason: z.enum(MANUAL_REASONS),
    note,
  })
  .refine((d) => d.mode === "set" ? d.value >= 0 : d.value !== 0, {
    message: "Ingresá una cantidad distinta de 0.",
    path: ["value"],
  });

export type AdjustStockInput = z.input<typeof adjustStockSchema>;
