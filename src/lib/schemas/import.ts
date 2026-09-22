import { z } from "zod";

/**
 * Schemas del importador (agente G). Compartidos entre el formulario
 * (client) y las actions / route handlers (server).
 */

export const ROUND_TO_VALUES = [0, 10, 100, 1000, 990] as const;

export const importOptionsSchema = z.object({
  /** Recargo sobre el precio de origen (ej. mayorista +40 %). */
  markup_percent: z.coerce.number().min(-90, "No puede ser menor a -90 %.").max(1000, "Máximo 1000 %.").default(0),
  /** 0 = sin redondeo; 10/100/1000 = múltiplo siguiente; 990 = termina en 990. */
  round_to: z.coerce
    .number()
    .refine((n) => (ROUND_TO_VALUES as readonly number[]).includes(n), "Elegí un redondeo válido.")
    .default(0),
  import_images: z.boolean().default(true),
  default_status: z.enum(["draft", "active"]).default("draft"),
  category_mode: z.enum(["create", "single", "none"]).default("create"),
  default_category_id: z.string().uuid("Elegí una categoría.").nullable().default(null),
  /** Re-sync: si es false, no pisa precios editados a mano. */
  sync_prices: z.boolean().default(true),
  /** Re-sync: si es false, no toca el stock de productos existentes. */
  sync_stock: z.boolean().default(true),
  /** Stock que se carga cuando la fuente sólo dice "en stock". */
  stock_when_unknown: z.coerce.number().int("Tiene que ser un número entero.").min(0).max(100000).default(10),
  /** Actualizar productos que ya existen (por external_id). */
  update_existing: z.boolean().default(true),
  /** Crear productos nuevos (false = sólo actualizar los que ya existen). */
  create_new: z.boolean().default(true),
  /** Pausa en la fase "review" para elegir qué importar. */
  review: z.boolean().default(false),
  /** Máximo de productos a traer de la fuente. */
  limit: z.coerce.number().int().min(1, "Mínimo 1.").max(5000, "Máximo 5000.").default(300),
});

export type ImportOptions = z.infer<typeof importOptionsSchema>;
export type ImportOptionsInput = z.input<typeof importOptionsSchema>;

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = importOptionsSchema.parse({});

/** Lee opciones guardadas en `import_jobs.options` tolerando datos viejos. */
export function readImportOptions(value: unknown): ImportOptions {
  const parsed = importOptionsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_IMPORT_OPTIONS;
}

export const urlAdapterSchema = z.enum(["auto", "woocommerce", "shopify", "jsonld"]);

export const detectInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Pegá la dirección de la tienda.")
    .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
    .pipe(z.string().url("La URL no es válida.")),
  adapter: urlAdapterSchema.default("auto"),
});

export const createJobSchema = detectInputSchema.extend({
  options: importOptionsSchema,
});

export type CreateJobInput = z.input<typeof createJobSchema>;

export const csvModeSchema = z.enum(["update", "create"]);
export type CsvMode = z.infer<typeof csvModeSchema>;

/** Límite del archivo CSV (P0-04). */
export const CSV_MAX_BYTES = 8 * 1024 * 1024;
/** Límite de filas por archivo. */
export const CSV_MAX_ROWS = 20000;

export const selectItemsSchema = z.object({
  jobId: z.string().uuid(),
  /** Ítems elegidos; `all: true` importa todos los pendientes. */
  itemIds: z.array(z.string().uuid()).max(CSV_MAX_ROWS).default([]),
  all: z.boolean().default(false),
});
