import { z } from "zod";

import { localDateTime, PROMO_SCOPES } from "./promotion";

/*
 * Cupones (agente C). Mismo criterio que promociones: JSON desde el form,
 * fechas locales de la tienda → UTC en la action.
 */

export const COUPON_TYPES = ["percent", "fixed", "free_shipping"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  percent: "Porcentaje",
  fixed: "Monto fijo",
  free_shipping: "Envío gratis",
};

export const COUPON_CODE_RE = /^[A-Z0-9_-]{2,40}$/;

/** Mayúsculas, sin espacios ni acentos. */
export function normalizeCouponCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
}

/** Código aleatorio legible (sin 0/O ni 1/I/L). */
export function generateCouponCode(length = 8, random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}

const optionalInt = z.number({ invalid_type_error: "Ingresá un número." }).int("Tiene que ser un número entero.").min(1, "Mínimo 1.").nullable();

export const couponSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCouponCode)
      .refine((v) => COUPON_CODE_RE.test(v), "Entre 2 y 40 caracteres: letras, números, guion o guion bajo."),
    type: z.enum(COUPON_TYPES),
    value: z.number({ invalid_type_error: "Ingresá un número." }).finite().min(0),
    minSubtotal: z.number({ invalid_type_error: "Ingresá un número." }).finite().min(0, "No puede ser negativo.").nullable(),
    maxUses: optionalInt,
    maxUsesPerCustomer: optionalInt,
    firstOrderOnly: z.boolean(),
    startsAt: localDateTime,
    endsAt: localDateTime,
    scope: z.enum(PROMO_SCOPES),
    categoryIds: z.array(z.string().uuid()).max(500).default([]),
    productIds: z.array(z.string().uuid()).max(2000).default([]),
    isActive: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "percent" && (c.value <= 0 || c.value > 100))
      ctx.addIssue({ code: "custom", path: ["value"], message: "Entre 1 y 100 %." });
    if (c.type === "fixed" && c.value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Tiene que ser mayor a 0." });
    if (c.scope === "categories" && c.categoryIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Elegí al menos una categoría." });
    if (c.scope === "products" && c.productIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Elegí al menos un producto." });
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Tiene que ser posterior al inicio." });
    if (c.maxUses != null && c.maxUsesPerCustomer != null && c.maxUsesPerCustomer > c.maxUses)
      ctx.addIssue({ code: "custom", path: ["maxUsesPerCustomer"], message: "No puede superar los usos totales." });
  })
  .transform((c) => ({ ...c, value: c.type === "free_shipping" ? 0 : c.value }));

export type CouponInput = z.input<typeof couponSchema>;
export type CouponValues = z.output<typeof couponSchema>;

export const EMPTY_COUPON: CouponValues = {
  code: "",
  type: "percent",
  value: 10,
  minSubtotal: null,
  maxUses: null,
  maxUsesPerCustomer: 1,
  firstOrderOnly: false,
  startsAt: "",
  endsAt: "",
  scope: "all",
  categoryIds: [],
  productIds: [],
  isActive: true,
};

export const testCouponSchema = z.object({
  code: z.string().transform(normalizeCouponCode),
  subtotal: z.number({ invalid_type_error: "Ingresá un número." }).finite().min(0, "No puede ser negativo."),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Email inválido.")]).default(""),
});
