/*
 * Medición del sitio de la plataforma (landing, planes, registro…), aparte
 * de la de cada tienda (`store_settings.integrations`, `StoreAnalytics`).
 * Todo sale de variables de entorno públicas y, si faltan, no se carga nada.
 */

const GA4_ID = /^G-[A-Z0-9]{4,16}$/;

/** ID de GA4 de la plataforma (`NEXT_PUBLIC_PLATFORM_GA4_ID`) o `null` si falta o no tiene formato `G-XXXX`. */
export function platformGa4Id(value: string | undefined = process.env.NEXT_PUBLIC_PLATFORM_GA4_ID): string | null {
  const id = (value ?? "").trim().toUpperCase();
  return GA4_ID.test(id) ? id : null;
}

/** Token de verificación de Google Search Console (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) o `null`. */
export function googleSiteVerification(
  value: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
): string | null {
  const token = (value ?? "").trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : null;
}
