import { z } from "zod";

/*
 * Promociones (agente C). El form manda JSON; las fechas llegan como
 * "YYYY-MM-DDTHH:mm" en la zona horaria de la tienda (vacío = sin límite)
 * y la action las convierte a UTC con `zonedLocalToIso`.
 */

export const PROMO_TYPES = ["percent", "fixed", "bxgy", "nth_unit_percent"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

/** Promos por cantidad: se guardan con `config` (migración 0017). */
export const QUANTITY_PROMO_TYPES: readonly PromoType[] = ["bxgy", "nth_unit_percent"];

export const PROMO_TYPE_OPTIONS: { value: PromoType; label: string }[] = [
  { value: "percent", label: "Porcentaje" },
  { value: "fixed", label: "Monto fijo por unidad" },
  { value: "bxgy", label: "Llevá X, pagá Y" },
  { value: "nth_unit_percent", label: "N.ª unidad con descuento" },
];

/** Cantidades de las promos por cantidad: enteros de 1 a 99 (null = no aplica al tipo). */
const units = z
  .number({ invalid_type_error: "Ingresá un número." })
  .int("Tiene que ser un número entero.")
  .min(1, "Tiene que ser 1 o más.")
  .max(99, "Máximo 99.")
  .nullable()
  .default(null);
export const PROMO_SCOPES = ["all", "categories", "products"] as const;
export type PromoScope = (typeof PROMO_SCOPES)[number];

export const PROMO_SCOPE_LABELS: Record<PromoScope, string> = {
  all: "Toda la tienda",
  categories: "Categorías",
  products: "Productos",
};

export const BADGE_MAX = 16;

/** Sin emojis ni pictogramas (DESIGN.md: la UI no usa emojis). */
export const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u;

/** "2026-11-02T00:00" o vacío. */
export const localDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v), "Fecha inválida.")
  .default("");

export const promotionSchema = z
  .object({
    name: z.string().trim().min(1, "Poné un nombre.").max(80, "Máximo 80 caracteres."),
    type: z.enum(PROMO_TYPES),
    /** percent: %; fixed: $ por unidad; nth_unit_percent: % de la N.ª unidad; bxgy: no se usa (0). */
    value: z.number({ invalid_type_error: "Ingresá un número." }).finite().min(0, "Tiene que ser mayor a 0."),
    /** bxgy: "Llevá X" (X ≥ 2). */
    buy: units,
    /** bxgy: "pagá Y" (1 ≤ Y < X). */
    pay: units,
    /** nth_unit_percent: cada cuántas unidades (N ≥ 2). */
    nth: units,
    scope: z.enum(PROMO_SCOPES),
    categoryIds: z.array(z.string().uuid()).max(500).default([]),
    productIds: z.array(z.string().uuid()).max(2000).default([]),
    startsAt: localDateTime,
    endsAt: localDateTime,
    priority: z.number({ invalid_type_error: "Ingresá un número." }).int("Tiene que ser un número entero.").min(-1000).max(1000),
    stackable: z.boolean(),
    badgeLabel: z
      .string()
      .trim()
      .max(BADGE_MAX, `Máximo ${BADGE_MAX} caracteres.`)
      .refine((v) => !EMOJI_RE.test(v), "Sin emojis.")
      .default(""),
    isActive: z.boolean(),
  })
  .superRefine((p, ctx) => {
    if (p.type === "percent" || p.type === "fixed") {
      if (p.value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Tiene que ser mayor a 0." });
      if (p.type === "percent" && p.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Máximo 100 %." });
    }
    if (p.type === "bxgy") {
      if (p.buy === null) ctx.addIssue({ code: "custom", path: ["buy"], message: "Ingresá cuántas unidades lleva." });
      else if (p.buy < 2) ctx.addIssue({ code: "custom", path: ["buy"], message: "Tiene que ser 2 o más." });
      if (p.pay === null) ctx.addIssue({ code: "custom", path: ["pay"], message: "Ingresá cuántas unidades paga." });
      else if (p.buy !== null && p.pay >= p.buy)
        ctx.addIssue({ code: "custom", path: ["pay"], message: "Tiene que ser menor que las que lleva." });
    }
    if (p.type === "nth_unit_percent") {
      if (p.nth === null) ctx.addIssue({ code: "custom", path: ["nth"], message: "Ingresá qué unidad tiene el descuento." });
      else if (p.nth < 2) ctx.addIssue({ code: "custom", path: ["nth"], message: "Desde la 2.ª unidad." });
      if (p.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Mínimo 1 %." });
      else if (p.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Máximo 100 %." });
    }
    if (p.scope === "categories" && p.categoryIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Elegí al menos una categoría." });
    if (p.scope === "products" && p.productIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Elegí al menos un producto." });
    if (p.startsAt && p.endsAt && p.endsAt <= p.startsAt)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Tiene que ser posterior al inicio." });
  });

export type PromotionInput = z.input<typeof promotionSchema>;
export type PromotionValues = z.infer<typeof promotionSchema>;

export const EMPTY_PROMOTION: PromotionValues = {
  name: "",
  type: "percent",
  value: 10,
  buy: null,
  pay: null,
  nth: null,
  scope: "all",
  categoryIds: [],
  productIds: [],
  startsAt: "",
  endsAt: "",
  priority: 0,
  stackable: false,
  badgeLabel: "",
  isActive: true,
};
