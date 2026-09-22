import { z } from "zod";

/**
 * Menús de navegación (`menus.items`, spec §3.2). Agente E.
 *
 * Formato guardado (compatible con `parseMenuItems` del storefront):
 *   { label, href, children[], newTab?, link? }
 * - `href` es lo que usa el storefront (ya resuelto).
 * - `link` guarda de dónde salió el destino (categoría, página, producto…)
 *   para que el editor muestre el picker correcto. El storefront lo ignora.
 * - `newTab`: abrir en pestaña nueva (el storefront agrega target/rel).
 */

export const MENU_HANDLES = ["header", "footer"] as const;
export type MenuHandle = (typeof MENU_HANDLES)[number];

export const MENU_LABELS: Record<MenuHandle, { title: string; description: string }> = {
  header: { title: "Menú principal", description: "Aparece en el encabezado de la tienda. Los ítems con subítems se abren como desplegable." },
  footer: { title: "Menú del pie", description: "Cada ítem de primer nivel es un grupo de links en el pie de página." },
};

export const LINK_KINDS = ["category", "page", "product", "internal", "external"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  category: "Categoría",
  page: "Página",
  product: "Producto",
  internal: "Ruta de la tienda",
  external: "URL externa",
};

export const MAX_MENU_DEPTH = 2;
export const MAX_MENU_ITEMS = 40;

const linkRefSchema = z.object({
  kind: z.enum(LINK_KINDS),
  /** id de la categoría / página / producto (sólo para esos tipos). */
  id: z.string().optional(),
});
export type LinkRef = z.infer<typeof linkRefSchema>;

/** Valida el destino: rutas internas empiezan con "/" o "#"; externas con http(s), mailto o tel. */
export function menuHrefError(href: string, kind: LinkKind = "internal"): string | null {
  const v = href.trim();
  if (!v) return "Elegí un destino.";
  if (/^\s*(javascript|data|vbscript):/i.test(v)) return "Ese link no está permitido.";
  if (kind === "external") {
    return /^(https?:\/\/|mailto:|tel:)/i.test(v) ? null : "Tiene que empezar con https://, mailto: o tel:.";
  }
  return /^[/#]/.test(v) ? null : "Tiene que empezar con «/» (ej. /productos).";
}

export interface MenuItemInput {
  label: string;
  href: string;
  newTab?: boolean;
  link?: LinkRef;
  children: MenuItemInput[];
}

const baseItem = {
  label: z.string().trim().min(1, "Poné una etiqueta.").max(60, "Hasta 60 caracteres."),
  href: z.string().trim().max(500),
  newTab: z.boolean().optional(),
  link: linkRefSchema.optional(),
};

function refineHref(item: { href: string; link?: LinkRef }, ctx: z.RefinementCtx) {
  const error = menuHrefError(item.href, item.link?.kind ?? (/^https?:/i.test(item.href) ? "external" : "internal"));
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["href"], message: error });
}

const childItemSchema = z.object({ ...baseItem, children: z.array(z.never()).max(0).default([]) }).superRefine(refineHref);

export const menuItemSchema = z
  .object({ ...baseItem, children: z.array(childItemSchema).max(20, "Hasta 20 subítems.").default([]) })
  .superRefine((item, ctx) => {
    // Un grupo (con subítems) puede no tener destino propio.
    if (item.children.length && !item.href.trim()) return;
    refineHref(item, ctx);
  });

export const saveMenuSchema = z.object({
  handle: z.enum(MENU_HANDLES),
  items: z
    .array(menuItemSchema)
    .max(MAX_MENU_ITEMS, `Hasta ${MAX_MENU_ITEMS} ítems.`)
    .superRefine((items, ctx) => {
      const total = items.reduce((n, i) => n + 1 + i.children.length, 0);
      if (total > 120) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El menú tiene demasiados links." });
    }),
});
export type SaveMenuInput = z.input<typeof saveMenuSchema>;
