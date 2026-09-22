import { z } from "zod";

import { FULFILLMENTS, ORDER_STATUSES } from "@/lib/admin/order-utils";

/**
 * Schemas zod de pedidos (compartidos entre formularios del admin y
 * Server Actions). Mensajes en español, secos (DESIGN.md §7.6).
 */

const uuid = z.string().uuid("Identificador inválido");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const money = z.coerce
  .number({ invalid_type_error: "Ingresá un monto" })
  .finite("Ingresá un monto")
  .min(0, "No puede ser negativo")
  .max(9_999_999_999, "Monto demasiado grande");

export const orderStatusSchema = z.enum(ORDER_STATUSES);

const urlOrEmpty = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\//i.test(v), "Tiene que empezar con http:// o https://");

export const changeStatusSchema = z
  .object({
    orderId: uuid,
    status: orderStatusSchema,
    reason: optionalText(300),
    carrier: optionalText(80),
    trackingNumber: optionalText(120),
    trackingUrl: urlOrEmpty,
  })
  .refine((v) => v.status !== "cancelled" || Boolean(v.reason), {
    message: "Elegí o escribí el motivo",
    path: ["reason"],
  });
export type ChangeStatusInput = z.input<typeof changeStatusSchema>;

export const bulkStatusSchema = z
  .object({
    ids: z.array(uuid).min(1, "Elegí al menos un pedido").max(200, "Máximo 200 pedidos por vez"),
    status: orderStatusSchema,
    reason: optionalText(300),
  })
  .refine((v) => v.status !== "cancelled" || Boolean(v.reason), {
    message: "Elegí o escribí el motivo",
    path: ["reason"],
  });
export type BulkStatusInput = z.input<typeof bulkStatusSchema>;

export const trackingSchema = z.object({
  orderId: uuid,
  carrier: optionalText(80),
  trackingNumber: optionalText(120),
  trackingUrl: urlOrEmpty,
});
export type TrackingInput = z.input<typeof trackingSchema>;

export const paymentSchema = z.object({
  orderId: uuid,
  amount: money.refine((v) => v > 0, "Tiene que ser mayor a 0"),
  methodCode: z.string().trim().min(1, "Elegí el método").max(40),
  reference: optionalText(120),
  receiptUrl: urlOrEmpty,
  /** "2026-09-22T15:30" (hora local del navegador) o ISO. */
  paidAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), "Fecha inválida"),
  note: optionalText(500),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const idsSchema = z.object({
  ids: z.array(uuid).min(1, "Elegí al menos un pedido").max(200, "Máximo 200 pedidos por vez"),
});

export const noteSchema = z.object({
  orderId: uuid,
  message: z.string().trim().min(1, "Escribí la nota").max(2000, "Máximo 2000 caracteres"),
  visibleToCustomer: z.boolean().default(false),
});
export type NoteInput = z.input<typeof noteSchema>;

export const internalNotesSchema = z.object({
  orderId: uuid,
  notes: z.string().max(5000, "Máximo 5000 caracteres"),
});

export const extendSchema = z.object({
  orderId: uuid,
  hours: z.number().int().min(1).max(24 * 14).default(24),
});

// ---------------------------------------------------------------------
// Pedido manual
// ---------------------------------------------------------------------

export const addressSchema = z.object({
  street: z.string().trim().max(160).default(""),
  number: z.string().trim().max(20).default(""),
  floor: z.string().trim().max(40).default(""),
  city: z.string().trim().max(120).default(""),
  province: z.string().trim().max(120).default(""),
  postal_code: z.string().trim().max(20).default(""),
  notes: z.string().trim().max(300).default(""),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const manualItemSchema = z.object({
  variantId: uuid,
  qty: z.coerce.number().int("Cantidad entera").min(1, "Mínimo 1").max(999, "Máximo 999"),
  unitPrice: money,
});

export const manualCustomerSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), id: uuid }),
  z.object({
    mode: z.literal("new"),
    name: z.string().trim().min(2, "Ingresá el nombre").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(160)
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email inválido"),
    phone: optionalText(40),
    doc: optionalText(30),
  }),
]);

export const manualOrderSchema = z
  .object({
    customer: manualCustomerSchema,
    items: z.array(manualItemSchema).min(1, "Agregá al menos un producto").max(100, "Máximo 100 productos"),
    fulfillment: z.enum(FULFILLMENTS),
    shippingAddress: addressSchema.optional(),
    shippingZoneId: uuid.nullable().optional(),
    shippingCost: money.default(0),
    pickupLocationId: uuid.nullable().optional(),
    paymentMethodCode: z.string().trim().min(1, "Elegí el método de pago").max(40),
    applyMethodDiscount: z.boolean().default(false),
    manualDiscount: money.default(0),
    notes: optionalText(2000),
    internalNotes: optionalText(5000),
    markPaid: z.boolean().default(false),
    reserve: z.boolean().default(false),
  })
  .refine((v) => v.fulfillment !== "delivery" || Boolean(v.shippingAddress?.street), {
    message: "Ingresá la calle",
    path: ["shippingAddress", "street"],
  });
export type ManualOrderInput = z.input<typeof manualOrderSchema>;

// ---------------------------------------------------------------------
// Arrepentimientos
// ---------------------------------------------------------------------

export const withdrawalActionSchema = z.object({
  id: uuid,
  action: z.enum(["process", "reject"]),
  cancelOrder: z.boolean().default(false),
  notes: optionalText(2000),
});
export type WithdrawalActionInput = z.input<typeof withdrawalActionSchema>;

export const withdrawalNotesSchema = z.object({
  id: uuid,
  notes: z.string().max(2000, "Máximo 2000 caracteres"),
});
