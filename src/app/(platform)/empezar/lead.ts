import { z } from "zod";

import { formatDateTime } from "@/lib/dates";
import { renderEmail, type EmailContent } from "@/lib/email/layout";
import { platformBrand } from "@/lib/email/templates/shared";
import { STORE_KINDS, type StoreKind } from "@/lib/tenant/kinds";

import { CATALOG_SIZES, type CatalogSize } from "./options";

export { CATALOG_SIZES, DEFAULT_KIND, type CatalogSize } from "./options";

/*
 * "Cargamos tu catálogo y lo probás 14 días" (/empezar; docs/gtm/PLAN-GTM.md
 * §6 y §7). Puro: validación, textos del aviso y del WhatsApp, y el cupo por
 * IP. La action (`actions.ts`) sólo lee el request, manda el mail y arma la
 * respuesta; así todo esto se prueba sin server.
 */

export interface CatalogRequest {
  /** Usuario de Instagram sin `@`, en minúsculas. */
  instagram: string;
  /** Sólo dígitos, como lo escribió (con o sin código de país). */
  whatsapp: string;
  products: CatalogSize;
  kind: StoreKind;
}

/** Valores tal como llegaron del formulario (para no vaciarlo si hay un error). */
export interface CatalogFormValues {
  instagram: string;
  whatsapp: string;
  products: string;
  kind: string;
}

export const CATALOG_ERRORS = {
  instagram: "Escribí el usuario de Instagram de tu marca.",
  whatsapp: "Escribí tu WhatsApp con código de área.",
  products: "Elegí cuántos productos vendés.",
  kind: "Elegí tu rubro.",
} as const;

/**
 * Usuario de Instagram desde lo que se suele pegar: `@Luna.Ropa`,
 * `luna.ropa`, `instagram.com/luna.ropa/` o el link completo con `?igsh=…`.
 * `null` si no es un usuario posible (letras, números, punto y guion bajo;
 * hasta 30, sin punto al principio ni al final).
 */
export function normalizeInstagram(raw: string): string | null {
  let v = raw.trim();
  v = v.replace(/^https?:\/\//i, "").replace(/^(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\//i, "");
  v = (v.split(/[/?#]/)[0] ?? "").replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(v)) return null;
  if (v.startsWith(".") || v.endsWith(".") || v.includes("..")) return null;
  return v;
}

/** Sólo dígitos; `null` si no puede ser un teléfono (8 a 15 dígitos). */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/**
 * Número para `wa.me` (internacional, sin `+`). Un celular argentino escrito
 * con código de área y sin país (`11 5555 5555`, `0381 555 5555`) pasa a
 * `549…`; con `54` y sin el `9`, se lo agrega. Lo demás queda como vino.
 */
export function whatsappIntl(digits: string): string {
  const d = digits.replace(/^0+/, "");
  if (d.startsWith("54")) return d.startsWith("549") ? d : `549${d.slice(2)}`;
  return d.length === 10 ? `549${d}` : d;
}

const kindIds = new Set<string>(STORE_KINDS.map((k) => k.id));
const sizeIds = new Set<string>(CATALOG_SIZES.map((s) => s.id));

export const catalogRequestSchema = z.object({
  instagram: z
    .string()
    .max(120, CATALOG_ERRORS.instagram)
    .transform((v, ctx) => {
      const handle = normalizeInstagram(v);
      if (!handle) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: CATALOG_ERRORS.instagram });
        return z.NEVER;
      }
      return handle;
    }),
  whatsapp: z
    .string()
    .max(40, CATALOG_ERRORS.whatsapp)
    .transform((v, ctx) => {
      const digits = normalizeWhatsapp(v);
      if (!digits) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: CATALOG_ERRORS.whatsapp });
        return z.NEVER;
      }
      return digits;
    }),
  products: z
    .string()
    .refine((v) => sizeIds.has(v), CATALOG_ERRORS.products)
    .transform((v) => v as CatalogSize),
  kind: z
    .string()
    .refine((v) => kindIds.has(v), CATALOG_ERRORS.kind)
    .transform((v) => v as StoreKind),
  /** Honeypot: oculto para personas. */
  website: z.string().max(500).optional(),
});

export function sizeLabel(size: CatalogSize): string {
  return CATALOG_SIZES.find((s) => s.id === size)?.label ?? size;
}

export function kindLabel(kind: StoreKind): string {
  return STORE_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** "Pedido de catálogo: @luna.ropa · Moda y accesorios · 30 a 100 productos" */
export function catalogRequestSubject(lead: CatalogRequest): string {
  const size = sizeLabel(lead.products);
  return `Pedido de catálogo: @${lead.instagram} · ${kindLabel(lead.kind)} · ${size.charAt(0).toLowerCase()}${size.slice(1)} productos`;
}

/** Mensaje con el que el comercio sigue por WhatsApp desde la pantalla de éxito. */
export function catalogWhatsappText(lead: Pick<CatalogRequest, "instagram" | "products" | "kind">): string {
  return `Hola, soy @${lead.instagram}, quiero que me carguen el catálogo.\nRubro: ${kindLabel(lead.kind)} · ${sizeLabel(lead.products)} productos`;
}

/** Primer mensaje sugerido para escribirle al comercio desde el aviso interno. */
export function catalogReplyText(lead: Pick<CatalogRequest, "instagram">): string {
  return `Hola, ¿cómo estás? Te escribo de Ecommy por la carga del catálogo de @${lead.instagram}. ¿Me pasás tu lista de precios, con talles y colores?`;
}

/** Aviso interno a `PLATFORM_EMAIL` con los datos del pedido y el link para escribirle. */
export function catalogRequestEmail(lead: CatalogRequest, opts: { platformUrl: string; requestedAt: string }): EmailContent {
  const subject = catalogRequestSubject(lead);
  const wa = `https://wa.me/${whatsappIntl(lead.whatsapp)}?text=${encodeURIComponent(catalogReplyText(lead))}`;
  return renderEmail({
    subject,
    preheader: `@${lead.instagram} quiere que le carguen el catálogo: ${kindLabel(lead.kind)}, ${sizeLabel(lead.products).toLowerCase()} productos.`,
    brand: platformBrand(opts.platformUrl),
    blocks: [
      { t: "heading", text: "Pedido de carga de catálogo" },
      { t: "p", content: [{ b: `@${lead.instagram}` }, " quiere que le carguen el catálogo para probar Ecommy 14 días con Pro."] },
      {
        t: "rows",
        rows: [
          { label: "Instagram", value: `@${lead.instagram}` },
          { label: "WhatsApp", value: `+${whatsappIntl(lead.whatsapp)}`, mono: true },
          { label: "Escribió", value: lead.whatsapp, mono: true },
          { label: "Productos hoy", value: sizeLabel(lead.products) },
          { label: "Rubro", value: kindLabel(lead.kind) },
          { label: "Fecha", value: formatDateTime(opts.requestedAt) },
        ],
      },
      {
        t: "p",
        content: [
          "Pedile la lista de precios, cargá sus 30 productos más vendidos con talles y colores, y coordiná la llamada de 30 minutos. ",
          { href: `https://www.instagram.com/${lead.instagram}/`, label: "Ver su Instagram" },
        ],
        muted: true,
      },
      { t: "button", href: wa, label: "Escribirle por WhatsApp" },
    ],
    footer: ["Aviso interno de Ecommy. Te llega porque esta dirección está en PLATFORM_EMAIL."],
  });
}

/**
 * Cupo básico en memoria: `max` pedidos por clave cada `windowMs`. Vive en el
 * proceso (en serverless, por instancia): frena el abuso obvio, no es un
 * límite exacto. Se poda solo para no crecer sin techo.
 */
export function createRateLimiter({ max, windowMs, maxKeys = 5000 }: { max: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  return {
    /** `true` si el pedido entra en el cupo (y lo cuenta). */
    hit(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      // Map conserva el orden de inserción: se descartan las claves más viejas.
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      return true;
    },
  };
}
