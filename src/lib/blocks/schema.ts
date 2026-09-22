import { nanoid } from "nanoid";
import { z } from "zod";

/**
 * Bloques del constructor de páginas (spec §9). `pages.blocks` es un array
 * de `Block`. Render público en `src/components/blocks/*` (agente E).
 */

export const blockStyleSchema = z.object({
  background: z.enum(["default", "surface", "primary", "custom"]).default("default"),
  customBg: z.string().optional(),
  paddingY: z.enum(["none", "sm", "md", "lg"]).default("md"),
  container: z.enum(["full", "normal", "narrow"]).default("normal"),
  hidden: z.boolean().optional(),
  hideOnMobile: z.boolean().optional(),
});
export type BlockStyle = z.infer<typeof blockStyleSchema>;

export const ctaSchema = z.object({
  label: z.string().max(80),
  href: z.string().max(500),
});
export type Cta = z.infer<typeof ctaSchema>;

const align = z.enum(["left", "center", "right"]);

export const productSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual"), productIds: z.array(z.string().uuid()).max(48) }),
  z.object({
    kind: z.literal("category"),
    categoryId: z.string().uuid(),
    limit: z.number().int().min(1).max(48),
  }),
  z.object({ kind: z.literal("tag"), tag: z.string().min(1), limit: z.number().int().min(1).max(48) }),
  z.object({ kind: z.literal("newest"), limit: z.number().int().min(1).max(48) }),
  z.object({ kind: z.literal("on_sale"), limit: z.number().int().min(1).max(48) }),
  z.object({ kind: z.literal("featured"), limit: z.number().int().min(1).max(48) }),
]);
export type ProductSource = z.infer<typeof productSourceSchema>;

const base = { id: z.string().min(1), style: blockStyleSchema };

export const heroBlockSchema = z.object({
  ...base,
  type: z.literal("hero"),
  settings: z.object({
    /** Línea chica arriba del título (opcional, DESIGN.md §6.5). Agregado por E. */
    eyebrow: z.string().max(120).optional(),
    title: z.string().max(200),
    subtitle: z.string().max(500).default(""),
    imageUrl: z.string().default(""),
    imageUrlMobile: z.string().optional(),
    /** Texto alternativo de la foto (vacío = decorativa). Agregado por E. */
    imageAlt: z.string().max(200).optional(),
    overlay: z.number().int().min(0).max(80).default(30),
    align: z.enum(["left", "center"]).default("left"),
    height: z.enum(["sm", "md", "lg", "screen"]).default("md"),
    cta: ctaSchema,
    cta2: ctaSchema.optional(),
  }),
});

const productListSettings = {
  title: z.string().max(200),
  subtitle: z.string().max(500).optional(),
  source: productSourceSchema,
  viewAllHref: z.string().optional(),
};

export const productSliderBlockSchema = z.object({
  ...base,
  type: z.literal("product_slider"),
  settings: z.object({
    ...productListSettings,
    cardsPerView: z.number().int().min(2).max(6).default(4),
  }),
});

export const productGridBlockSchema = z.object({
  ...base,
  type: z.literal("product_grid"),
  settings: z.object({
    ...productListSettings,
    columns: z.number().int().min(2).max(5).default(4),
    rows: z.number().int().min(1).max(12).optional(),
  }),
});

export const bannerItemSchema = z.object({
  imageUrl: z.string(),
  imageUrlMobile: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  cta: ctaSchema.optional(),
  href: z.string().optional(),
  align: align.default("left"),
  overlay: z.number().int().min(0).max(80).default(20),
  textColor: z.enum(["light", "dark"]).default("light"),
});
export type BannerItem = z.infer<typeof bannerItemSchema>;

export const bannerGridBlockSchema = z.object({
  ...base,
  type: z.literal("banner_grid"),
  settings: z.object({
    columns: z.number().int().min(1).max(4).default(2),
    ratio: z.enum(["1:1", "4:5", "16:9", "21:9", "auto"]).default("16:9"),
    gap: z.enum(["none", "sm", "md"]).default("md"),
    items: z.array(bannerItemSchema).max(12),
  }),
});

export const richTextBlockSchema = z.object({
  ...base,
  type: z.literal("rich_text"),
  settings: z.object({
    html: z.string().max(100_000),
    align: align.default("left"),
    maxWidth: z.enum(["narrow", "normal", "full"]).default("normal"),
  }),
});

export const headingBlockSchema = z.object({
  ...base,
  type: z.literal("heading"),
  settings: z.object({
    text: z.string().max(300),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    align: align.default("left"),
    eyebrow: z.string().max(120).optional(),
  }),
});

export const imageTextBlockSchema = z.object({
  ...base,
  type: z.literal("image_text"),
  settings: z.object({
    imageUrl: z.string(),
    imagePosition: z.enum(["left", "right"]).default("left"),
    title: z.string().max(200),
    html: z.string().max(50_000),
    cta: ctaSchema.optional(),
  }),
});

export const categoryListBlockSchema = z.object({
  ...base,
  type: z.literal("category_list"),
  settings: z.object({
    title: z.string().max(200).optional(),
    categoryIds: z.union([z.array(z.string().uuid()), z.literal("all")]),
    style: z.enum(["cards", "chips", "circles"]).default("cards"),
    columns: z.number().int().min(2).max(8).default(4),
  }),
});

export const featuresBlockSchema = z.object({
  ...base,
  type: z.literal("features"),
  settings: z.object({
    items: z
      .array(
        z.object({
          /** Nombre de un icono de lucide-react (ej. "Truck"). */
          icon: z.string().max(60),
          title: z.string().max(120),
          text: z.string().max(500),
        }),
      )
      .max(12),
    columns: z.number().int().min(2).max(4).default(3),
  }),
});

export const faqBlockSchema = z.object({
  ...base,
  type: z.literal("faq"),
  settings: z.object({
    title: z.string().max(200).optional(),
    items: z.array(z.object({ q: z.string().max(300), a: z.string().max(5000) })).max(50),
  }),
});

export const countdownBlockSchema = z.object({
  ...base,
  type: z.literal("countdown"),
  settings: z.object({
    title: z.string().max(200),
    /** ISO 8601. */
    endsAt: z.string(),
    text: z.string().max(500).optional(),
    /** Texto que se muestra cuando la cuenta llega a cero (vacío = el bloque se oculta). Agregado por E. */
    expiredText: z.string().max(500).optional(),
    cta: ctaSchema.optional(),
  }),
});

export const testimonialsBlockSchema = z.object({
  ...base,
  type: z.literal("testimonials"),
  settings: z.object({
    items: z
      .array(
        z.object({
          quote: z.string().max(1000),
          author: z.string().max(120),
          meta: z.string().max(120).optional(),
        }),
      )
      .max(24),
  }),
});

export const videoBlockSchema = z.object({
  ...base,
  type: z.literal("video"),
  settings: z.object({
    /** YouTube, Vimeo o .mp4 directo. */
    url: z.string().max(500),
    ratio: z.enum(["16:9", "4:3", "1:1", "9:16"]).default("16:9"),
  }),
});

export const dividerBlockSchema = z.object({
  ...base,
  type: z.literal("divider"),
  settings: z.object({
    style: z.enum(["line", "space"]).default("line"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
  }),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  productSliderBlockSchema,
  productGridBlockSchema,
  bannerGridBlockSchema,
  richTextBlockSchema,
  headingBlockSchema,
  imageTextBlockSchema,
  categoryListBlockSchema,
  featuresBlockSchema,
  faqBlockSchema,
  countdownBlockSchema,
  testimonialsBlockSchema,
  videoBlockSchema,
  dividerBlockSchema,
]);

export const blocksSchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const BLOCK_TYPES = [
  "hero",
  "product_slider",
  "product_grid",
  "banner_grid",
  "rich_text",
  "heading",
  "image_text",
  "category_list",
  "features",
  "faq",
  "countdown",
  "testimonials",
  "video",
  "divider",
] as const satisfies readonly BlockType[];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Portada",
  product_slider: "Carrusel de productos",
  product_grid: "Grilla de productos",
  banner_grid: "Banners",
  rich_text: "Texto enriquecido",
  heading: "Título",
  image_text: "Imagen y texto",
  category_list: "Categorías",
  features: "Beneficios",
  faq: "Preguntas frecuentes",
  countdown: "Cuenta regresiva",
  testimonials: "Testimonios",
  video: "Video",
  divider: "Separador",
};

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  background: "default",
  paddingY: "md",
  container: "normal",
};

type BlockFactories = { [K in BlockType]: (id: string, style: BlockStyle) => BlockOf<K> };

const FACTORIES: BlockFactories = {
  hero: (id, style) => ({
    id,
    type: "hero",
    style: { ...style, container: "full", paddingY: "none" },
    settings: {
      title: "Título principal",
      subtitle: "Una bajada corta que explique la propuesta.",
      imageUrl: "",
      overlay: 30,
      align: "left",
      height: "md",
      cta: { label: "Ver productos", href: "/productos" },
    },
  }),
  product_slider: (id, style) => ({
    id,
    type: "product_slider",
    style,
    settings: {
      title: "Novedades",
      source: { kind: "newest", limit: 12 },
      viewAllHref: "/productos",
      cardsPerView: 4,
    },
  }),
  product_grid: (id, style) => ({
    id,
    type: "product_grid",
    style,
    settings: { title: "Destacados", source: { kind: "featured", limit: 8 }, columns: 4 },
  }),
  banner_grid: (id, style) => ({
    id,
    type: "banner_grid",
    style,
    settings: {
      columns: 2,
      ratio: "16:9",
      gap: "md",
      items: [
        { imageUrl: "", title: "Banner 1", align: "left", overlay: 20, textColor: "light" },
        { imageUrl: "", title: "Banner 2", align: "left", overlay: 20, textColor: "light" },
      ],
    },
  }),
  rich_text: (id, style) => ({
    id,
    type: "rich_text",
    style,
    settings: { html: "<p>Escribí acá tu texto.</p>", align: "left", maxWidth: "normal" },
  }),
  heading: (id, style) => ({
    id,
    type: "heading",
    style,
    settings: { text: "Título de sección", level: 2, align: "left" },
  }),
  image_text: (id, style) => ({
    id,
    type: "image_text",
    style,
    settings: {
      imageUrl: "",
      imagePosition: "left",
      title: "Nuestra historia",
      html: "<p>Contá quiénes son.</p>",
    },
  }),
  category_list: (id, style) => ({
    id,
    type: "category_list",
    style,
    settings: { title: "Categorías", categoryIds: "all", style: "cards", columns: 4 },
  }),
  features: (id, style) => ({
    id,
    type: "features",
    style,
    settings: {
      columns: 3,
      items: [
        { icon: "Truck", title: "Envíos", text: "Llegamos a todo el país." },
        { icon: "Landmark", title: "Transferencia", text: "Descuento pagando por transferencia." },
        { icon: "MessageCircle", title: "Atención", text: "Te respondemos por WhatsApp." },
      ],
    },
  }),
  faq: (id, style) => ({
    id,
    type: "faq",
    style,
    settings: {
      title: "Preguntas frecuentes",
      items: [{ q: "¿Hacen envíos?", a: "Sí, a todo el país." }],
    },
  }),
  countdown: (id, style) => ({
    id,
    type: "countdown",
    style,
    settings: {
      title: "Termina pronto",
      endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    },
  }),
  testimonials: (id, style) => ({
    id,
    type: "testimonials",
    style,
    // Nace vacío: nunca reseñas inventadas (DESIGN.md §1.1).
    settings: { items: [] },
  }),
  video: (id, style) => ({ id, type: "video", style, settings: { url: "", ratio: "16:9" } }),
  divider: (id, style) => ({ id, type: "divider", style, settings: { style: "line", size: "md" } }),
};

/** Bloque nuevo con valores razonables (para la paleta del builder). */
export function defaultBlock<T extends BlockType>(type: T): BlockOf<T> {
  const factory = FACTORIES[type] as (id: string, style: BlockStyle) => BlockOf<T>;
  return factory(nanoid(10), { ...DEFAULT_BLOCK_STYLE });
}

/**
 * Parsea los bloques guardados. Los inválidos se descartan (y se cuentan en
 * `errors`) para que una página no se rompa entera por un bloque.
 */
export function parseBlocks(value: unknown): { blocks: Block[]; errors: number } {
  if (!Array.isArray(value)) return { blocks: [], errors: 0 };
  const blocks: Block[] = [];
  let errors = 0;
  for (const raw of value) {
    const r = blockSchema.safeParse(raw);
    if (r.success) blocks.push(r.data);
    else errors++;
  }
  return { blocks, errors };
}
