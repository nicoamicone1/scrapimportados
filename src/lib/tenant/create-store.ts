import { z } from "zod";

import { STORE_KINDS } from "./kinds";
import { storeSlugProblem, STORE_SLUG_MESSAGES } from "./slug";

/** Schema del wizard de alta de tienda (/app/nueva): lo comparten el form y la action. */
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const createStoreSchema = z
  .object({
    name: z.string().trim().min(2, "Usá al menos 2 caracteres.").max(60, "Hasta 60 caracteres."),
    slug: z.string().trim().toLowerCase(),
    kind: z.enum(STORE_KINDS.map((k) => k.id) as [string, ...string[]], { errorMap: () => ({ message: "Elegí un rubro." }) }),
    whatsapp: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v === "" || (v.length >= 10 && v.length <= 15), "Ingresá el número con código de país y área, ej. 5493816173548."),
    city: optionalText(80),
    province: optionalText(80),
    currency: z.enum(["ARS", "USD"]).default("ARS"),
    transferEnabled: z.boolean(),
    transferDiscount: z.coerce.number().min(0, "Entre 0 y 50.").max(50, "Entre 0 y 50."),
    bankName: optionalText(80),
    holder: optionalText(120),
    cbu: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, ""))
      .refine((v) => v === "" || /^\d{22}$/.test(v), "El CBU/CVU tiene 22 números."),
    alias: optionalText(40),
    cuit: optionalText(20),
    whatsappEnabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const problem = storeSlugProblem(v.slug);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["slug"], message: STORE_SLUG_MESSAGES[problem] });
    if (!v.transferEnabled && !v.whatsappEnabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["whatsappEnabled"], message: "Elegí al menos una forma de cobro." });
    }
    if (v.whatsappEnabled && !v.whatsapp) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["whatsapp"], message: "Para acordar por WhatsApp necesitamos tu número." });
    }
  });

export type CreateStoreInput = z.input<typeof createStoreSchema>;

