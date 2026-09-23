import { z } from "zod";

import { blocksSchema } from "@/lib/blocks/schema";

/**
 * Páginas del builder (spec §3.7 + §13). Compartido entre los formularios
 * del admin (client) y las actions (server). Agente E.
 */

/** Slugs que usa el storefront (spec §3.7 y §13) + los de Next. `home` es la portada. */
export const RESERVED_PAGE_SLUGS = [
  "home",
  "productos",
  "producto",
  "categoria",
  "carrito",
  "checkout",
  "pedido",
  "admin",
  "api",
  "buscar",
  "_next",
  "arrepentimiento",
  "politicas",
  "sitemap",
  "sitemap-xml",
  "robots",
  "robots-txt",
  "feeds",
  // Rutas de metadata de Next (íconos e imagen para compartir).
  "icon",
  "apple-icon",
  "opengraph-image",
] as const;

/** Prefijos reservados: Next sirve `opengraph-image-<hash>` y variantes. */
export const RESERVED_PAGE_SLUG_PREFIXES = ["opengraph-image"] as const;

export const PAGE_TYPES = ["home", "landing", "legal", "custom"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  home: "Portada",
  landing: "Landing",
  legal: "Legal",
  custom: "Página",
};

export const PAGE_STATUS = ["draft", "published"] as const;
export type PageStatus = (typeof PAGE_STATUS)[number];

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mensaje de error del slug o `null` si es válido (para validar en vivo). */
export function pageSlugError(slug: string, { isHome = false }: { isHome?: boolean } = {}): string | null {
  if (isHome) return slug === "home" ? null : "La portada siempre usa el slug «home».";
  if (!slug) return "Poné un slug.";
  if (slug.length > 80) return "Hasta 80 caracteres.";
  if (!SLUG_RE.test(slug)) return "Sólo minúsculas, números y guiones (sin acentos ni espacios).";
  if (
    (RESERVED_PAGE_SLUGS as readonly string[]).includes(slug) ||
    RESERVED_PAGE_SLUG_PREFIXES.some((prefix) => slug.startsWith(`${prefix}-`))
  ) {
    return `«${slug}» lo usa la tienda. Elegí otro.`;
  }
  return null;
}

export const pageSeoSchema = z.object({
  title: z.string().trim().max(SEO_TITLE_MAX, `Hasta ${SEO_TITLE_MAX} caracteres.`).default(""),
  description: z.string().trim().max(SEO_DESCRIPTION_MAX, `Hasta ${SEO_DESCRIPTION_MAX} caracteres.`).default(""),
  og_image_url: z.string().trim().max(1000).default(""),
});
export type PageSeo = z.infer<typeof pageSeoSchema>;

export const PAGE_TEMPLATES = ["blank", "campaign", "about", "legal"] as const;
export type PageTemplateId = (typeof PAGE_TEMPLATES)[number];

/** Alta de página (dialog "Nueva página"). */
export const createPageSchema = z
  .object({
    title: z.string().trim().min(1, "Poné un título.").max(120, "Hasta 120 caracteres."),
    slug: z.string().trim().toLowerCase(),
    type: z.enum(["landing", "legal", "custom"]),
    template: z.enum(PAGE_TEMPLATES).default("blank"),
  })
  .superRefine((v, ctx) => {
    const error = pageSlugError(v.slug);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["slug"], message: error });
  });
export type CreatePageInput = z.input<typeof createPageSchema>;

/** Guardado desde el editor (borrador; publicar es otra action). */
export const savePageSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, "Poné un título.").max(120, "Hasta 120 caracteres."),
    slug: z.string().trim().toLowerCase(),
    type: z.enum(PAGE_TYPES),
    showInMenu: z.boolean().default(false),
    seo: pageSeoSchema,
    blocks: blocksSchema.max(60, "Hasta 60 bloques por página."),
  })
  .superRefine((v, ctx) => {
    const error = pageSlugError(v.slug, { isHome: v.type === "home" });
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["slug"], message: error });
  });
export type SavePageInput = z.input<typeof savePageSchema>;
export type SavePageData = z.output<typeof savePageSchema>;
