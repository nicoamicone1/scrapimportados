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

export const STYLE_GRIDS = ["uniform", "feature", "list"] as const;
export const STYLE_FILTERS = ["sidebar", "bar", "drawer"] as const;
export const STYLE_GALLERIES = ["thumbs", "grid", "stack", "carousel"] as const;

export const themeStyleSchema = z.object({
  /** Disposición de la portada (bloque hero en `layout: "auto"`): foto a sangre, mitad y mitad, enmarcada, tipográfica o apilada. */
  hero: z.enum(["cover", "split", "framed", "poster", "stack"]),
  /** Encabezados de sección: solo, con regla, centrado, numerado o con etiqueta. */
  titles: z.enum(["plain", "rule", "centered", "index", "tag"]),
  /** Forma de las imágenes de campaña, categorías y banners (nunca la foto de la ficha). */
  shape: z.enum(["rect", "soft", "arch", "bubble"]),
  /**
   * Disposición de la tarjeta de producto: apilada (foto + texto), texto sobre
   * la foto, en caja con botón visible, en fila (lista de precios) o baldosa
   * (panel con botón "+" que aparece sobre la foto).
   */
  card: z.enum(["stack", "overlay", "boxed", "row", "tile"]),
  /** Movimiento: ninguno, suave (entradas y hovers con curva) o animado (marquesinas, escalonados). */
  motion: z.enum(["none", "soft", "lively"]),
  /*
   * Sumados en 2026-10 (S1). Cada uno con default propio: un `style` guardado
   * con los cinco campos de arriba sigue validando, y `parseTheme` completa
   * los que falten con los del preset guardado.
   */
  /** Grilla del catálogo: pareja, con destacados a doble ancho o lista. */
  grid: z.enum(STYLE_GRIDS).default("uniform"),
  /** Filtros del catálogo: columna lateral, barra de pastillas arriba o sólo un panel. */
  filters: z.enum(STYLE_FILTERS).default("sidebar"),
  /** Galería de la ficha: miniaturas al costado, grilla de fotos, fotos apiladas o carrusel a sangre. */
  gallery: z.enum(STYLE_GALLERIES).default("thumbs"),
});
export type ThemeStyle = z.infer<typeof themeStyleSchema>;

export const DEFAULT_THEME_STYLE: ThemeStyle = {
  hero: "cover",
  titles: "plain",
  shape: "rect",
  card: "stack",
  motion: "soft",
  grid: "uniform",
  filters: "sidebar",
  gallery: "thumbs",
};

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
    /**
     * logo-left: logo · nav · buscador · carrito · logo-center: nav · LOGO · iconos
     * · minimal: logo + "Menú Buscar Carrito (2)" en texto · stacked: logo grande
     * centrado arriba y la nav en una segunda fila · pill: pastilla flotante
     * despegada de los bordes · double: buscador protagonista arriba y las
     * categorías en una banda de color debajo (catálogos grandes).
     */
    layout: z.enum(["logo-left", "logo-center", "minimal", "stacked", "pill", "double"]),
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
    /** simple · columns · minimal · statement (nombre de la tienda gigante) · band (hoja de color primario). */
    style: z.enum(["simple", "columns", "minimal", "statement", "band"]),
    showSocial: z.boolean(),
    showPayments: z.boolean(),
    /**
     * Crédito "Hecho con Ecommy" en la banda legal (BRAND.md §12): obligatorio
     * en Free; desde Starter el dueño lo puede apagar. No es parte del estilo:
     * aplicar un preset lo conserva y cambiarlo no pasa el tema a "custom".
     */
    showCredit: z.boolean().default(true),
  }),
  /**
   * Carácter del estilo (docs/DESIGN.md §3.9): lo que hace que dos presets no
   * se parezcan aunque compartan colores. Se emite como `data-hero|titles|
   * shape|card|motion` en `.store-root`. Tiene default: los temas guardados
   * antes de 2026-10 siguen validando.
   */
  style: themeStyleSchema.default(DEFAULT_THEME_STYLE),
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
