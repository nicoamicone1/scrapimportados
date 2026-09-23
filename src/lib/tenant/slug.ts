/**
 * Slugs de tienda (subdominio). Espejo de `public.check_store_slug()` en la
 * migración 0011: si cambiás uno, cambiá el otro.
 */

export const STORE_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const STORE_SLUG_MIN = 3;
export const STORE_SLUG_MAX = 40;

/** Reservados: subdominios de infraestructura, rutas de la plataforma y la demo. */
export const RESERVED_STORE_SLUGS: readonly string[] = [
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "ecommy",
  "platform",
  "static",
  "cdn",
  "demo",
  "s",
  "login",
  "registro",
  "planes",
  "auth",
  "invitacion",
  "soporte",
  "ayuda",
  "blog",
];

export type StoreSlugProblem = "empty" | "short" | "long" | "format" | "reserved";

/** Validación de formato (sin mirar la base). `null` = válido. */
export function storeSlugProblem(slug: string): StoreSlugProblem | null {
  if (!slug) return "empty";
  if (slug.length < STORE_SLUG_MIN) return "short";
  if (slug.length > STORE_SLUG_MAX) return "long";
  if (!STORE_SLUG_RE.test(slug)) return "format";
  if (RESERVED_STORE_SLUGS.includes(slug)) return "reserved";
  return null;
}

export const STORE_SLUG_MESSAGES: Record<StoreSlugProblem | "taken", string> = {
  empty: "Elegí la dirección de tu tienda.",
  short: `Usá al menos ${STORE_SLUG_MIN} caracteres.`,
  long: `Usá hasta ${STORE_SLUG_MAX} caracteres.`,
  format: "Sólo minúsculas, números y guiones (sin guiones al principio ni al final).",
  reserved: "Esa dirección está reservada. Probá con otra.",
  taken: "Esa dirección ya está en uso. Probá con otra.",
};

/** Normaliza un texto libre a slug de tienda (sin acentos, kebab, recortado). */
export function toStoreSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, STORE_SLUG_MAX)
    .replace(/-+$/g, "");
}
