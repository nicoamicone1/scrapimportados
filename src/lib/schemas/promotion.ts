import { z } from "zod";

/*
 * Promociones (agente C). El form manda JSON; las fechas llegan como
 * "YYYY-MM-DDTHH:mm" en la zona horaria de la tienda (vacío = sin límite)
 * y la action las convierte a UTC con `zonedLocalToIso`.
 */

export const PROMO_TYPES = ["percent", "fixed"] as const;
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
    value: z.number({ invalid_type_error: "Ingresá un número." }).finite().gt(0, "Tiene que ser mayor a 0."),
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
    if (p.type === "percent" && p.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Máximo 100 %." });
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
