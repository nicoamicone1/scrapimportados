import { z } from "zod";

import { MAX_SPECS } from "@/lib/admin/specs";
import { MAX_OPTIONS, MAX_VARIANTS, optionKey } from "@/lib/admin/variant-matrix";
import { formatMoney, roundMoney } from "@/lib/money";
import { MAX_PRICE_TIERS_DB, MAX_TIER_QTY } from "@/lib/pricing/tiers";

/*
 * Schemas de productos (compartidos entre el form del admin y las actions).
 * El form manda JSON (no FormData): números como number, vacíos como null.
 */

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

export const PRODUCT_SOURCES = ["manual", "import", "scrape"] as const;
export const PRODUCT_SOURCE_LABELS: Record<(typeof PRODUCT_SOURCES)[number], string> = {
  manual: "Carga manual",
  import: "Importado",
  scrape: "Scraping",
};

/** Alícuotas de IVA habilitadas (null = la de la tienda). */
export const VAT_RATES = [0, 10.5, 21, 27] as const;

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;
export const MAX_RELATED = 8;
export const MAX_TAGS = 30;

const trimmed = (max: number, message?: string) => z.string().trim().max(max, message ?? `Hasta ${max} caracteres.`);

/** "" → null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Hasta ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const money = z
  .number({ invalid_type_error: "Ingresá un número.", required_error: "Ingresá un precio." })
  .finite("Ingresá un número.")
  .min(0, "Tiene que ser 0 o más.")
  .max(9_999_999_999, "Es demasiado grande.");

const optionalMoney = money.nullish().transform((v) => (v === undefined ? null : v));

const optionalInt = (min: number, message: string) =>
  z
    .number({ invalid_type_error: "Ingresá un número entero." })
    .int("Tiene que ser un número entero.")
    .min(min, message)
    .nullish()
    .transform((v) => (v === undefined ? null : v));

export const seoSchema = z.object({
  title: trimmed(SEO_TITLE_MAX, `Hasta ${SEO_TITLE_MAX} caracteres.`).default(""),
  description: trimmed(SEO_DESCRIPTION_MAX, `Hasta ${SEO_DESCRIPTION_MAX} caracteres.`).default(""),
});

export const slugSchema = z
  .string()
  .trim()
  .max(120, "Hasta 120 caracteres.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Sólo minúsculas, números y guiones.");

export const optionSchema = z.object({
  name: trimmed(40).min(1, "Poné un nombre a la opción."),
  values: z.array(trimmed(60).min(1)).min(1, "Agregá al menos un valor.").max(100, "Hasta 100 valores."),
});

export const variantSchema = z.object({
  id: z.string().uuid().nullish(),
  title: trimmed(200).default("Default"),
  option_values: z.record(z.string()).default({}),
  sku: optionalText(64),
  barcode: optionalText(64),
  price: money,
  compare_at_price: optionalMoney,
  cost: optionalMoney,
  /** Stock que quiere dejar el admin. */
  stock: z.number({ invalid_type_error: "Ingresá un número entero." }).int("Tiene que ser un número entero.").min(-99999).max(9_999_999),
  /** Stock que vio al abrir el form (null = variante nueva). El server ajusta por la diferencia. */
  stock_original: z.number().int().nullish(),
  track_inventory: z.boolean().default(true),
  allow_backorder: z.boolean().default(false),
  low_stock_threshold: optionalInt(0, "Tiene que ser 0 o más."),
  weight_grams: optionalInt(0, "Tiene que ser 0 o más."),
  image_id: z.string().uuid().nullish().transform((v) => v ?? null),
  is_active: z.boolean().default(true),
});

/** Tramo de precio por cantidad: "Desde `min_qty` unidades → $ `price` c/u". */
export const priceTierSchema = z.object({
  min_qty: z
    .number({ invalid_type_error: "Ingresá un número entero.", required_error: "Ingresá desde cuántas unidades." })
    .int("Tiene que ser un número entero.")
    .min(2, "Tiene que ser 2 o más.")
    .max(MAX_TIER_QTY, `Hasta ${MAX_TIER_QTY} unidades.`),
  price: z
    .number({ invalid_type_error: "Ingresá un número.", required_error: "Ingresá el precio." })
    .finite("Ingresá un número.")
    .gt(0, "Tiene que ser mayor a 0.")
    .max(9_999_999_999, "Es demasiado grande.")
    // A centavos ANTES de las reglas del producto: se valida lo que se guarda
    // (900,004 contra un tramo anterior de 900 es 900: "tiene que ser menor").
    .transform(roundMoney)
    .refine((v) => v > 0, "Tiene que ser mayor a 0."),
});

/**
 * Precio base contra el que se validan los tramos: el más bajo de las
 * variantes activas (o de todas, si ninguna está activa). Así el tramo baja
 * el precio de TODAS las variantes y la tabla de la ficha es una sola.
 */
export function tierBasePrice(variants: { price: number; is_active?: boolean }[]): number | null {
  const valid = variants.filter((v) => Number.isFinite(v.price) && v.price > 0);
  const active = valid.filter((v) => v.is_active !== false);
  const pool = active.length ? active : valid;
  return pool.length ? Math.min(...pool.map((v) => v.price)) : null;
}

export const specSchema = z.object({
  label: trimmed(80).min(1, "Completá la etiqueta."),
  value: trimmed(500).min(1, "Completá el valor."),
});

export const productSchema = z
  .object({
    id: z.string().uuid().nullish(),
    name: trimmed(200).min(1, "Ingresá el nombre del producto."),
    /** Vacío → se genera desde el nombre. */
    slug: z.union([slugSchema, z.literal("")]).default(""),
    description_html: z.string().max(200_000, "La descripción es demasiado larga.").default(""),
    short_description: optionalText(300),
    status: z.enum(PRODUCT_STATUSES).default("draft"),
    brand: optionalText(80),
    tags: z.array(trimmed(40).min(1)).max(MAX_TAGS, `Hasta ${MAX_TAGS} etiquetas.`).default([]),
    featured: z.boolean().default(false),
    vat_percent: z
      .number()
      .nullish()
      .transform((v) => (v === undefined ? null : v))
      .refine((v) => v === null || (VAT_RATES as readonly number[]).includes(v), "Elegí una alícuota válida."),
    options: z.array(optionSchema).max(MAX_OPTIONS, `Hasta ${MAX_OPTIONS} opciones.`).default([]),
    variants: z
      .array(variantSchema)
      .min(1, "El producto necesita al menos una variante.")
      .max(MAX_VARIANTS, `Hasta ${MAX_VARIANTS} variantes.`),
    category_ids: z.array(z.string().uuid()).max(50).default([]),
    specs: z.array(specSchema).max(MAX_SPECS, `Hasta ${MAX_SPECS} filas.`).default([]),
    related_ids: z.array(z.string().uuid()).max(MAX_RELATED, `Hasta ${MAX_RELATED} productos.`).default([]),
    /**
     * Precios por cantidad (mayorista). Ordenados por cantidad; se guardan sólo con la migración 0021.
     * Acepta el tope de la base (10) para no trabar un producto que ya los tenga; el editor
     * del panel ofrece agregar hasta `MAX_PRICE_TIERS` (4).
     */
    price_tiers: z.array(priceTierSchema).max(MAX_PRICE_TIERS_DB, `Hasta ${MAX_PRICE_TIERS_DB} tramos.`).default([]),
    seo: seoSchema.default({ title: "", description: "" }),
    /** Nota para los movimientos de stock que genere este guardado. */
    stock_note: optionalText(200),
  })
  .superRefine((data, ctx) => {
    // Opciones sin duplicados.
    const names = new Set<string>();
    data.options.forEach((o, i) => {
      const key = o.name.toLowerCase();
      if (names.has(key)) ctx.addIssue({ code: "custom", path: ["options", i, "name"], message: `Ya hay una opción "${o.name}".` });
      names.add(key);
      const values = o.values.map((v) => v.toLowerCase());
      if (new Set(values).size !== values.length) {
        ctx.addIssue({ code: "custom", path: ["options", i, "values"], message: "Hay valores repetidos." });
      }
    });

    // Variantes: combinaciones válidas y sin repetir; SKU sin repetir.
    const combos = new Set<string>();
    const skus = new Map<string, number>();
    data.variants.forEach((v, i) => {
      const keys = Object.keys(v.option_values);
      const validShape =
        keys.length === data.options.length &&
        data.options.every((o) => o.values.includes(v.option_values[o.name] ?? "\u0000"));
      if (!validShape) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "title"], message: "La variante no coincide con las opciones." });
      }
      const key = optionKey(v.option_values);
      if (combos.has(key)) ctx.addIssue({ code: "custom", path: ["variants", i, "title"], message: "Variante repetida." });
      combos.add(key);
      if (v.sku) {
        const skuKey = v.sku.toLowerCase();
        if (skus.has(skuKey)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Este SKU ya está en otra variante." });
        skus.set(skuKey, i);
      }
      if (v.compare_at_price !== null && v.compare_at_price !== undefined && v.compare_at_price > 0 && v.compare_at_price <= v.price) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "compare_at_price"],
          message: "Tiene que ser mayor al precio (o dejalo vacío).",
        });
      }
    });
    if (data.options.length === 0 && data.variants.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Un producto sin opciones tiene una sola variante." });
    }
    // Precios por cantidad: cantidades crecientes, precios decrecientes y menores al precio base.
    const base = tierBasePrice(data.variants);
    data.price_tiers.forEach((t, i) => {
      const prev = data.price_tiers[i - 1];
      if (prev && t.min_qty <= prev.min_qty) {
        ctx.addIssue({ code: "custom", path: ["price_tiers", i, "min_qty"], message: `Tiene que ser más que el tramo anterior (${prev.min_qty}).` });
      }
      if (base !== null && t.price >= base) {
        ctx.addIssue({ code: "custom", path: ["price_tiers", i, "price"], message: `Tiene que ser menor al precio base (${formatMoney(base)}).` });
      } else if (prev && t.price >= prev.price) {
        ctx.addIssue({ code: "custom", path: ["price_tiers", i, "price"], message: `Tiene que ser menor al del tramo anterior (${formatMoney(prev.price)}).` });
      }
    });
    if (data.id && data.related_ids.includes(data.id)) {
      ctx.addIssue({ code: "custom", path: ["related_ids"], message: "No puede relacionarse consigo mismo." });
    }
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;
export type VariantInput = z.input<typeof variantSchema>;

/** Edición inline desde el listado (productos de una sola variante). */
export const inlineEditSchema = z
  .object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    price: money.optional(),
    compare_at_price: optionalMoney.optional(),
    stock: z.number().int("Tiene que ser un número entero.").min(-99999).max(9_999_999).optional(),
    stock_original: z.number().int().optional(),
  })
  .refine((d) => d.price !== undefined || d.stock !== undefined || d.compare_at_price !== undefined, "No hay cambios.");

export const BULK_PRODUCT_ACTIONS = ["publish", "draft", "archive", "restore", "add_category", "remove_category"] as const;

export const bulkProductSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1, "Elegí al menos un producto.").max(500, "Hasta 500 productos por vez."),
    action: z.enum(BULK_PRODUCT_ACTIONS),
    categoryId: z.string().uuid().nullish(),
  })
  .refine((d) => !(d.action === "add_category" || d.action === "remove_category") || Boolean(d.categoryId), {
    message: "Elegí una categoría.",
    path: ["categoryId"],
  });

export type BulkProductAction = (typeof BULK_PRODUCT_ACTIONS)[number];

export const duplicateSchema = z.object({
  id: z.string().uuid(),
  images: z.boolean().default(true),
});

/** Imagen ya subida al bucket desde el navegador. */
export const uploadedImageSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1).max(300),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  alt: optionalText(200),
});

export const addImagesSchema = z.object({
  productId: z.string().uuid(),
  images: z.array(uploadedImageSchema).min(1).max(30),
});
