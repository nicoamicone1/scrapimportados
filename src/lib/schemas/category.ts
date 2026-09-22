import { z } from "zod";

import { seoSchema, slugSchema } from "./product";

export const categorySchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, "Ingresá el nombre.").max(100, "Hasta 100 caracteres."),
  /** Vacío → se genera desde el nombre. */
  slug: z.union([slugSchema, z.literal("")]).default(""),
  parent_id: z.string().uuid().nullish().transform((v) => v ?? null),
  description: z
    .string()
    .trim()
    .max(2000, "Hasta 2000 caracteres.")
    .nullish()
    .transform((v) => (v ? v : null)),
  image_url: z
    .string()
    .url("La imagen no es válida.")
    .nullish()
    .transform((v) => v ?? null),
  is_visible: z.boolean().default(true),
  seo: seoSchema.default({ title: "", description: "" }),
});

export type CategoryInput = z.input<typeof categorySchema>;

export const reorderCategoriesSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      parent_id: z.string().uuid().nullable(),
      position: z.number().int().min(0),
    }),
  )
  .min(1)
  .max(2000);
