import { z } from "zod";

import type { BulkRule } from "@/lib/pricing";

/*
 * Cambios masivos de precios (agente C). Compartido entre el asistente
 * (client) y las actions (server). La regla tiene la forma de `BulkRule`
 * del motor (`src/lib/pricing/bulk.ts`).
 */

export const SCOPE_KINDS = ["all", "categories", "products", "brand", "tag", "price_range"] as const;
export type PriceScopeKind = (typeof SCOPE_KINDS)[number];

export const SCOPE_KIND_LABELS: Record<PriceScopeKind, string> = {
  all: "Todo el catálogo",
  categories: "Por categorías",
  products: "Por productos",
  brand: "Por marca",
  tag: "Por etiqueta",
  price_range: "Por rango de precio",
};

const money = z.number({ invalid_type_error: "Ingresá un número." }).finite().min(0, "No puede ser negativo.");

export const priceScopeSchema = z
  .object({
    kind: z.enum(SCOPE_KINDS),
    categoryIds: z.array(z.string().uuid()).max(500).default([]),
    includeChildren: z.boolean().default(true),
    productIds: z.array(z.string().uuid()).max(2000).default([]),
    brand: z.string().trim().max(120).default(""),
    tag: z.string().trim().max(120).default(""),
    minPrice: money.nullable().default(null),
    maxPrice: money.nullable().default(null),
    inStockOnly: z.boolean().default(false),
  })
  .superRefine((s, ctx) => {
    if (s.kind === "categories" && s.categoryIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Elegí al menos una categoría." });
    if (s.kind === "products" && s.productIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Elegí al menos un producto." });
    if (s.kind === "brand" && !s.brand) ctx.addIssue({ code: "custom", path: ["brand"], message: "Elegí una marca." });
    if (s.kind === "tag" && !s.tag) ctx.addIssue({ code: "custom", path: ["tag"], message: "Elegí una etiqueta." });
    if (s.kind === "price_range") {
      if (s.minPrice == null && s.maxPrice == null)
        ctx.addIssue({ code: "custom", path: ["minPrice"], message: "Indicá un mínimo, un máximo o ambos." });
      if (s.minPrice != null && s.maxPrice != null && s.minPrice > s.maxPrice)
        ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "Tiene que ser mayor o igual al mínimo." });
    }
  });

export type PriceScope = z.infer<typeof priceScopeSchema>;
export type PriceScopeInput = z.input<typeof priceScopeSchema>;

export const DEFAULT_SCOPE: PriceScope = {
  kind: "all",
  categoryIds: [],
  includeChildren: true,
  productIds: [],
  brand: "",
  tag: "",
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
};

/** Para `pricing_scope_variants(p_scope)` (snake_case). */
export function scopeToRpc(scope: PriceScope) {
  return {
    kind: scope.kind,
    category_ids: scope.categoryIds,
    include_children: scope.includeChildren,
    product_ids: scope.productIds,
    brand: scope.brand,
    tag: scope.tag,
    min_price: scope.minPrice,
    max_price: scope.maxPrice,
    in_stock_only: scope.inStockOnly,
  };
}

const positive = (msg = "Tiene que ser mayor a 0.") => z.number({ invalid_type_error: "Ingresá un número." }).finite().gt(0, msg);

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("percent"),
    direction: z.enum(["increase", "decrease"]),
    value: positive().max(1000, "Máximo 1000 %."),
    alsoCompareAt: z.boolean(),
  }),
  z.object({
    type: z.literal("amount"),
    direction: z.enum(["increase", "decrease"]),
    value: positive().max(100_000_000, "Es demasiado."),
    alsoCompareAt: z.boolean(),
  }),
  z.object({
    type: z.literal("margin"),
    marginPercent: z.number({ invalid_type_error: "Ingresá un número." }).finite().min(0, "No puede ser negativo.").max(10_000, "Es demasiado."),
  }),
  z.object({ type: z.literal("compare_from_price"), percent: positive().max(1000, "Máximo 1000 %.") }),
  z.object({ type: z.literal("clear_compare") }),
  z.object({ type: z.literal("sale_from_price"), discountPercent: positive().lt(100, "Tiene que ser menor a 100 %.") }),
]);

export const bulkRuleSchema = z
  .object({
    action: actionSchema,
    rounding: z.enum(["none", "to10", "to100", "to1000", "end990", "end99"]),
    roundingDirection: z.enum(["nearest", "up", "down"]),
    min: money.nullable(),
    max: money.nullable(),
  })
  .superRefine((r, ctx) => {
    if (r.action.type === "percent" && r.action.direction === "decrease" && r.action.value >= 100)
      ctx.addIssue({ code: "custom", path: ["action", "value"], message: "Para bajar, tiene que ser menor a 100 %." });
    if (r.min != null && r.max != null && r.min > r.max)
      ctx.addIssue({ code: "custom", path: ["max"], message: "Tiene que ser mayor o igual al mínimo." });
  });

// Chequeo en compilación: el schema produce un BulkRule válido.
export type BulkRuleParsed = z.infer<typeof bulkRuleSchema>;
const _ruleCompat: (r: BulkRuleParsed) => BulkRule = (r) => r;
void _ruleCompat;

export const DEFAULT_RULE: BulkRule = {
  action: { type: "percent", direction: "increase", value: 10, alsoCompareAt: true },
  rounding: "none",
  roundingDirection: "nearest",
  min: null,
  max: null,
};

export const applyPriceUpdateSchema = z.object({
  scope: priceScopeSchema,
  rule: bulkRuleSchema,
  /** Variantes que el usuario destildó en la vista previa. */
  excludedIds: z.array(z.string().uuid()).max(20_000).default([]),
  /** Cantidad que vio en la vista previa (para avisar si cambió). */
  expectedCount: z.number().int().min(0),
});

export type ApplyPriceUpdateInput = z.input<typeof applyPriceUpdateSchema>;

/** Tamaño de cada lote al aplicar (spec: chunks de 200). */
export const APPLY_CHUNK_SIZE = 200;
/** Máximo de variantes por cambio masivo (protege el server). */
export const MAX_BULK_VARIANTS = 10_000;
