import { z } from "zod";

import { FONT_IDS, getFont } from "./fonts";

/**
 * Schema del tema del storefront (`store_settings.theme`). Spec §8 + docs/DESIGN.md §3.
 * Es la fuente de verdad: el editor de apariencia (agente E) y `cssVars()`
 * trabajan sobre `Theme`.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usá un color hex (#RRGGBB)");

/** Los 5 originales, los 5 de 2026-09 (mismo orden que el selector) y "custom" al final. */
export const PRESET_IDS = [
  "atelier",
  "mercado",
  "nordico",
  "editorial",
  "neon",
  "botica",
  "recreo",
  "lapacho",
  "galpon",
  "bodega",
  "custom",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const themeColorsSchema = z.object({
  background: hex,
  surface: hex,
  text: hex,
  textMuted: hex,
  primary: hex,
  primaryText: hex,
  secondary: hex,
  accent: hex,
  border: hex,
  success: hex,
  danger: hex,
});

export const fontIdSchema = z.enum(FONT_IDS);

const weight = z
  .number()
  .int()
  .min(100)
  .max(900)
  .refine((w) => w % 100 === 0, "El peso va de 100 a 900 en pasos de 100");

export const themeFontsSchema = z
  .object({
    heading: fontIdSchema,
    body: fontIdSchema,
    headingWeight: weight,
    bodyWeight: weight,
    headingTransform: z.enum(["none", "uppercase"]),
    headingTracking: z.enum(["tight", "normal", "wide"]),
    baseSize: z.union([z.literal(15), z.literal(16), z.literal(17)]),
  })
  .superRefine((f, ctx) => {
    if (!getFont(f.heading).weights.includes(f.headingWeight)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["headingWeight"], message: "Esa fuente no tiene ese peso" });
    }
    if (!getFont(f.body).weights.includes(f.bodyWeight)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bodyWeight"], message: "Esa fuente no tiene ese peso" });
    }
    if (getFont(f.body).headingOnly) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "Esa fuente es sólo para títulos" });
    }
  });

export const themeSchema = z.object({
  preset: z.enum(PRESET_IDS),
  colors: themeColorsSchema,
  fonts: themeFontsSchema,
  radius: z.enum(["none", "sm", "md", "lg", "full"]),
  buttons: z.object({
    style: z.enum(["solid", "outline", "soft"]),
    shape: z.enum(["radius", "square", "pill"]),
    uppercase: z.boolean(),
  }),
  cards: z.object({
    style: z.enum(["flat", "bordered", "elevated"]),
    imageRatio: z.enum(["1:1", "4:5", "3:4", "16:9"]),
    hover: z.enum(["none", "zoom", "lift"]),
    showSku: z.boolean(),
    showBrand: z.boolean(),
    /** "$ X con transferencia" debajo del precio (spec §13 · P0-20). */
    showTransferPrice: z.boolean().default(true),
    /** "Precio sin impuestos nacionales" (spec §13 · P0-15); además requiere `store_settings.tax.show_net_price`. */
    showNetPrice: z.boolean().default(true),
  }),
  header: z.object({
    layout: z.enum(["logo-left", "logo-center", "minimal"]),
    sticky: z.boolean(),
    transparentOnHome: z.boolean(),
    showSearch: z.boolean(),
  }),
  layout: z.object({
    density: z.enum(["compact", "comfortable", "airy"]),
    containerWidth: z.enum(["narrow", "normal", "wide"]),
    gridColumns: z.object({
      mobile: z.union([z.literal(1), z.literal(2)]),
      desktop: z.union([z.literal(3), z.literal(4), z.literal(5)]),
    }),
  }),
  footer: z.object({
    style: z.enum(["simple", "columns", "minimal"]),
    showSocial: z.boolean(),
    showPayments: z.boolean(),
  }),
  effects: z.object({
    shadows: z.enum(["none", "soft", "strong"]),
    dividers: z.boolean(),
    imageFilter: z.enum(["none", "grain", "mono"]),
  }),
  custom_css: z.string().max(20000).optional(),
});

export type Theme = z.infer<typeof themeSchema>;
export type ThemeColors = z.infer<typeof themeColorsSchema>;
export type ThemeFonts = z.infer<typeof themeFontsSchema>;
