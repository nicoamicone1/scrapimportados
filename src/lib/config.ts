/**
 * Configuración del sitio. Un solo lugar para tocar la marca y el WhatsApp.
 */

/** Nombre de la marca (header, metadata, mensaje de WhatsApp). */
export const BRAND_NAME = "Catálogo";

/**
 * Teléfono de WhatsApp en formato internacional SIN "+", espacios ni guiones.
 * Ej. Argentina: 54 9 <área sin 0> <número sin 15>.
 */
export const WHATSAPP_PHONE = "5493816173548";

/** Link directo al WhatsApp de la marca (hero, footer). */
export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${WHATSAPP_PHONE}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
