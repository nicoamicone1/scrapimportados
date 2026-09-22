import { z } from "zod";

import { addressSchema } from "./order";

/** Cliente (alta/edición desde el admin). El email es opcional pero único. */
export const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Ingresá el nombre").max(120, "Máximo 120 caracteres"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Email inválido"),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  docNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : null)),
  address: addressSchema.optional(),
  notes: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((v) => (v ? v : null)),
  /** Tags separados por coma. */
  tags: z
    .string()
    .max(500)
    .optional()
    .transform((v) =>
      Array.from(
        new Set(
          (v ?? "")
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .map((t) => t.slice(0, 40)),
        ),
      ).slice(0, 20),
    ),
});
export type CustomerInput = z.input<typeof customerSchema>;

export const customerNotesSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(5000, "Máximo 5000 caracteres"),
});
