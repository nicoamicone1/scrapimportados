import { isFallbackMode, storeUrl } from "@/lib/tenant/urls";

/*
 * Datos públicos del sitio de la plataforma (landing, planes, legales,
 * contacto, pie). Isomórfico y sin secretos: se puede importar desde
 * cualquier componente.
 */

/** Mail de contacto público de Ecommy (pie, /contacto, legales, JSON-LD). */
export const PLATFORM_EMAIL = "hola@ecommy.app";

/** Fecha de la versión vigente de /terminos y /privacidad (ISO, sin hora). */
export const LEGAL_UPDATED_AT = "2026-09-23";

/**
 * Titular del servicio para los textos legales. Mientras esté en `null`,
 * /terminos y /privacidad dicen que esos datos se informan a pedido por
 * mail. Completar con los datos reales antes de lanzar (ver el comentario
 * al pie de `terminos/page.tsx`).
 */
export const PLATFORM_OWNER: { name: string | null; taxId: string | null; address: string | null } = {
  name: null,
  taxId: null,
  address: null,
};

/** "23 de septiembre de 2026" (fecha ISO sin hora, sin corrimiento de zona). */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/**
 * Link de WhatsApp de la plataforma (`PLATFORM_WHATSAPP`, sólo dígitos con
 * código de país) o `null` si no está configurado o no es un número.
 */
export function platformWhatsappHref(number: string | undefined | null, text?: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/**
 * Dirección de ejemplo de una tienda tal como la vería el dueño en este
 * entorno: `taller-luna.ecommy.app` con subdominios, o
 * `ecommy.app/s/taller-luna` en modo fallback. Sin protocolo.
 */
export function exampleStoreAddress(slug = "tu-tienda", rootDomain?: string): string {
  return storeUrl({ slug }, "/", rootDomain).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** `true` cuando las tiendas viven en subdominio propio (`<slug>.<dominio>`). */
export function storesUseSubdomains(rootDomain?: string): boolean {
  return !isFallbackMode(rootDomain);
}
