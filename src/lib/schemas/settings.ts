import { z } from "zod";

/*
 * Schemas de Configuración (agente H). Compartidos entre los formularios
 * (client) y las Server Actions (server). Cada schema describe EXACTAMENTE
 * la forma que se escribe en `store_settings` (ver src/lib/store/settings.ts
 * y supabase/migrations/0002_audit_gaps.sql).
 */

// ---------------------------------------------------------------------
// Validadores argentinos y de contacto
// ---------------------------------------------------------------------

/** Deja sólo dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * CBU / CVU: 22 dígitos con dos dígitos verificadores.
 * Bloque 1 (8): entidad (3) + sucursal (4) + verificador.
 * Bloque 2 (14): cuenta (13) + verificador.
 */
export function isValidCbu(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 22 || d !== value.replace(/[\s-]/g, "")) return false;
  const check = (digits: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
    return (10 - (sum % 10)) % 10;
  };
  const b1 = d.slice(0, 8);
  const b2 = d.slice(8);
  return (
    check(b1, [7, 1, 3, 9, 7, 1, 3]) === Number(b1[7]) &&
    check(b2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) === Number(b2[13])
  );
}

/** CUIT / CUIL: 11 dígitos, prefijo válido y dígito verificador (módulo 11). */
export function isValidCuit(value: string): boolean {
  const raw = value.trim();
  if (!/^\d{2}-?\d{8}-?\d$/.test(raw)) return false;
  const d = onlyDigits(raw);
  if (!["20", "23", "24", "25", "26", "27", "30", "33", "34"].includes(d.slice(0, 2))) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(d[10]);
}

/** "20123456786" → "20-12345678-6". */
export function formatCuit(value: string): string {
  const d = onlyDigits(value);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : value.trim();
}

/** Alias CBU: 6 a 20 caracteres, letras, números, punto y guion. */
export function isValidAlias(value: string): boolean {
  return /^[A-Za-z0-9.-]{6,20}$/.test(value.trim());
}

/** Normaliza un teléfono a E.164 SIN "+" (sólo dígitos). */
export function normalizePhone(value: string): string {
  return onlyDigits(value);
}

/** E.164 sin "+": 8 a 15 dígitos, sin 0 inicial (ej. 5491123456789). */
export function isValidE164(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(value);
}

// ---------------------------------------------------------------------
// Catálogos de opciones
// ---------------------------------------------------------------------

export const CURRENCIES = [
  { value: "ARS", label: "ARS · Peso argentino" },
  { value: "USD", label: "USD · Dólar estadounidense" },
  { value: "UYU", label: "UYU · Peso uruguayo" },
  { value: "CLP", label: "CLP · Peso chileno" },
  { value: "MXN", label: "MXN · Peso mexicano" },
  { value: "COP", label: "COP · Peso colombiano" },
  { value: "PEN", label: "PEN · Sol peruano" },
  { value: "EUR", label: "EUR · Euro" },
] as const;

export const LOCALES = [
  { value: "es-AR", label: "Español (Argentina)" },
  { value: "es-UY", label: "Español (Uruguay)" },
  { value: "es-CL", label: "Español (Chile)" },
  { value: "es-MX", label: "Español (México)" },
  { value: "es-CO", label: "Español (Colombia)" },
  { value: "es-PE", label: "Español (Perú)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "en-US", label: "Inglés (Estados Unidos)" },
] as const;

export const TIMEZONES = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Argentina/Cordoba", label: "Argentina (Córdoba)" },
  { value: "America/Argentina/Mendoza", label: "Argentina (Mendoza)" },
  { value: "America/Argentina/Salta", label: "Argentina (Salta)" },
  { value: "America/Argentina/Tucuman", label: "Argentina (Tucumán)" },
  { value: "America/Argentina/Ushuaia", label: "Argentina (Ushuaia)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)" },
  { value: "America/Sao_Paulo", label: "Brasil (San Pablo)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
] as const;

export const VAT_OPTIONS = [0, 10.5, 21, 27] as const;

export const OUT_OF_STOCK_OPTIONS = [
  { value: "show", label: "Mostrarlos normalmente" },
  { value: "show_last", label: "Mostrarlos al final del listado" },
  { value: "hide", label: "Ocultarlos del listado" },
] as const;

export const SOCIAL_KEYS = ["instagram", "facebook", "tiktok", "x", "youtube"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

// ---------------------------------------------------------------------
// Helpers de zod
// ---------------------------------------------------------------------

const trimmed = (max: number) => z.string().trim().max(max, `Hasta ${max} caracteres.`);

/** Texto opcional: "" → null. */
const optionalText = (max: number) =>
  trimmed(max).transform((v) => (v === "" ? null : v));

const httpUrl = z
  .string()
  .trim()
  .max(500, "Hasta 500 caracteres.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Tiene que empezar con https://.");

/** Número desde input (string o number). Vacío → NaN (falla con el mensaje). */
const num = (message = "Ingresá un número.") =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? Number.NaN : Number(v.replace(",", "."))) : v),
    z.number({ invalid_type_error: message }).refine((n) => Number.isFinite(n), message),
  );

/** Número opcional: vacío → null. */
const optionalNum = (message = "Ingresá un número.") =>
  z.preprocess(
    (v) => (v === null || v === undefined || (typeof v === "string" && v.trim() === "") ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number({ invalid_type_error: message }).refine((n) => Number.isFinite(n), message).nullable(),
  );

const percent = num("Ingresá un porcentaje.").pipe(
  z.number().min(0, "Tiene que ser entre 0 y 100.").max(100, "Tiene que ser entre 0 y 100."),
);

// ---------------------------------------------------------------------
// 1. Tienda
// ---------------------------------------------------------------------

export const storeSettingsSchema = z.object({
  name: trimmed(80).min(1, "Ingresá el nombre de la tienda."),
  tagline: optionalText(140),
  contact_email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Ingresá un email válido.")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  contact_phone: optionalText(40),
  whatsapp_phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => v === "" || isValidE164(v), "Tiene que tener código de país y área, sin 0 ni 15 (ej. 5491123456789).")
    .transform((v) => (v === "" ? null : v)),
  address: optionalText(200),
  currency: z.enum(CURRENCIES.map((c) => c.value) as [string, ...string[]], { errorMap: () => ({ message: "Elegí una moneda." }) }),
  locale: z.enum(LOCALES.map((c) => c.value) as [string, ...string[]], { errorMap: () => ({ message: "Elegí un idioma." }) }),
  timezone: z.enum(TIMEZONES.map((c) => c.value) as [string, ...string[]], { errorMap: () => ({ message: "Elegí una zona horaria." }) }),
  social: z.object({
    instagram: httpUrl,
    facebook: httpUrl,
    tiktok: httpUrl,
    x: httpUrl,
    youtube: httpUrl,
  }),
});
export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;
export type StoreSettingsOutput = z.output<typeof storeSettingsSchema>;

// ---------------------------------------------------------------------
// 2. Pagos y checkout
// ---------------------------------------------------------------------

export const paymentMethodSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  type: z.enum(["transfer", "whatsapp", "cash", "other"]),
  name: trimmed(60).min(1, "Ingresá un nombre."),
  is_active: z.boolean(),
  discount_percent: percent,
  instructions_md: z.string().trim().max(2000, "Hasta 2000 caracteres."),
});
export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;

export const transferSchema = z.object({
  bank_name: trimmed(80),
  holder: trimmed(120),
  cbu: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || isValidCbu(v), "El CBU/CVU tiene que tener 22 dígitos válidos."),
  alias: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidAlias(v), "Entre 6 y 20 caracteres: letras, números, punto o guion.")
    .transform((v) => v.toUpperCase()),
  cuit: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCuit(v), "El CUIT no es válido (11 dígitos, ej. 30-12345678-1).")
    .transform((v) => (v === "" ? "" : formatCuit(v))),
  instructions_md: z.string().trim().max(2000, "Hasta 2000 caracteres."),
});

/*
 * Variables de las plantillas de WhatsApp: son las que resuelve el storefront
 * (S) en `src/lib/store/whatsapp.ts` (`buildOrderMessage`, `buildProductMessage`),
 * con llaves simples: `{number}`.
 */
export const WHATSAPP_ORDER_VARS = [
  { key: "number", label: "Número de pedido (sin #)" },
  { key: "name", label: "Nombre del cliente" },
  { key: "items", label: "Productos, uno por línea" },
  { key: "total", label: "Total" },
  { key: "delivery", label: "Envío o retiro" },
  { key: "payment", label: "Método de pago" },
  { key: "store", label: "Nombre de la tienda" },
  { key: "url", label: "Link al pedido (si no lo ponés, se agrega al final)" },
] as const;

/** Plantilla por defecto del mensaje de pedido (la misma que usa el storefront). */
export { DEFAULT_ORDER_TEMPLATE as DEFAULT_WHATSAPP_ORDER_TEMPLATE } from "@/lib/store/whatsapp";

export const WHATSAPP_BUTTON_VARS = [
  { key: "product", label: "Producto (sólo en la ficha)" },
  { key: "url", label: "Link de la página" },
] as const;

export const paymentsSettingsSchema = z.object({
  methods: z.array(paymentMethodSchema).min(1),
  transfer: transferSchema,
  whatsapp_template: z
    .string()
    .trim()
    .min(1, "Escribí el mensaje.")
    .max(1000, "Hasta 1000 caracteres (WhatsApp corta los mensajes largos)."),
  require_phone: z.boolean(),
  order_notes_enabled: z.boolean(),
  min_order_total: num().pipe(z.number().min(0, "No puede ser negativo.")),
  reservation_hours: num().pipe(
    z.number().int("Usá horas enteras.").min(0, "No puede ser negativo.").max(720, "Hasta 720 horas (30 días)."),
  ),
  inventory_policy: z.enum(["on_order", "on_paid"]),
  low_stock_threshold: num().pipe(z.number().int("Usá un número entero.").min(0, "No puede ser negativo.").max(100000)),
  out_of_stock_display: z.enum(["show", "show_last", "hide"]),
  free_shipping_bar: z.object({
    enabled: z.boolean(),
    threshold: optionalNum().pipe(z.number().min(0, "No puede ser negativo.").nullable()),
  }),
  whatsapp_button: z.object({
    enabled: z.boolean(),
    position: z.enum(["right", "left"]),
    message_template: z.string().trim().max(500, "Hasta 500 caracteres."),
    show_on_mobile: z.boolean(),
    show_on_desktop: z.boolean(),
  }),
});
export type PaymentsSettingsInput = z.input<typeof paymentsSettingsSchema>;
export type PaymentsSettingsOutput = z.output<typeof paymentsSettingsSchema>;

// ---------------------------------------------------------------------
// 3. Impuestos y legales
// ---------------------------------------------------------------------

export const POLICY_KEYS = ["shipping_md", "returns_md", "privacy_md", "terms_md"] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export const legalSettingsSchema = z.object({
  tax: z.object({
    show_net_price: z.boolean(),
    default_vat_percent: num().pipe(
      z.number().refine((n) => (VAT_OPTIONS as readonly number[]).includes(n), "Elegí 0, 10,5, 21 o 27 %."),
    ),
    label: trimmed(60).min(1, "Ingresá la leyenda."),
  }),
  legal: z.object({
    country: z.enum(["AR", "UY", "CL", "PY", "BO", "PE", "CO", "MX", "ES", "OTHER"]),
    razon_social: optionalText(120),
    cuit: z
      .string()
      .trim()
      .refine((v) => v === "" || isValidCuit(v), "El CUIT no es válido (11 dígitos, ej. 30-12345678-1).")
      .transform((v) => (v === "" ? null : formatCuit(v))),
    consumer_defense_link: z.boolean(),
    data_fiscal: z.object({
      image_url: httpUrl
        .refine((v) => !/<|script/i.test(v), "Pegá sólo la URL de la imagen, no el script.")
        .transform((v) => (v === "" ? null : v)),
      href: httpUrl
        .refine((v) => !/<|script/i.test(v), "Pegá sólo el link, no el script.")
        .transform((v) => (v === "" ? null : v)),
    }),
  }),
  policies: z.object({
    shipping_md: z.string().max(30000, "Hasta 30.000 caracteres."),
    returns_md: z.string().max(30000, "Hasta 30.000 caracteres."),
    privacy_md: z.string().max(30000, "Hasta 30.000 caracteres."),
    terms_md: z.string().max(30000, "Hasta 30.000 caracteres."),
  }),
});
export type LegalSettingsInput = z.input<typeof legalSettingsSchema>;
export type LegalSettingsOutput = z.output<typeof legalSettingsSchema>;

// ---------------------------------------------------------------------
// 4. SEO, integraciones y mantenimiento
// ---------------------------------------------------------------------

/** Acepta el token o el `<meta name="google-site-verification" content="…">` entero. */
export function extractSiteVerification(value: string): string {
  const m = /content\s*=\s*["']([^"']+)["']/i.exec(value);
  return (m ? m[1] : value).trim();
}

const idField = (re: RegExp, message: string, normalize: (v: string) => string = (v) => v.trim()) =>
  z
    .string()
    .transform(normalize)
    .refine((v) => v === "" || re.test(v), message)
    .transform((v) => (v === "" ? null : v));

export const seoSettingsSchema = z.object({
  seo: z.object({
    title: trimmed(70),
    description: trimmed(160),
    og_image_url: httpUrl,
  }),
  integrations: z.object({
    ga4_id: idField(/^G-[A-Z0-9]{4,15}$/, "Tiene que tener la forma G-XXXXXXXXXX.", (v) => v.trim().toUpperCase()),
    gtm_id: idField(/^GTM-[A-Z0-9]{4,12}$/, "Tiene que tener la forma GTM-XXXXXXX.", (v) => v.trim().toUpperCase()),
    meta_pixel_id: idField(/^\d{10,20}$/, "El ID del Pixel son sólo números (entre 10 y 20)."),
    google_site_verification: idField(
      /^[A-Za-z0-9_-]{10,100}$/,
      "Pegá el código de verificación (o la etiqueta meta completa).",
      extractSiteVerification,
    ),
  }),
  maintenance: z.object({
    enabled: z.boolean(),
    message: trimmed(300),
  }),
});
export type SeoSettingsInput = z.input<typeof seoSettingsSchema>;
export type SeoSettingsOutput = z.output<typeof seoSettingsSchema>;

// ---------------------------------------------------------------------
// Redirecciones 301
// ---------------------------------------------------------------------

/** Normaliza una ruta de origen: "/a/b/" → "/a/b"; quita el dominio si pegaron la URL completa. */
export function normalizeFromPath(value: string): string {
  let v = value.trim();
  const m = /^https?:\/\/[^/]+(\/.*)?$/i.exec(v);
  if (m) v = m[1] ?? "/";
  v = v.split("#")[0];
  if (v.length > 1) v = v.replace(/\/+$/, "");
  return v;
}

export const redirectSchema = z
  .object({
    from_path: z
      .string()
      .transform(normalizeFromPath)
      .refine((v) => v.startsWith("/"), "Tiene que empezar con /.")
      .refine((v) => v !== "/", "No podés redirigir la portada.")
      .refine((v) => !/\s/.test(v), "No puede tener espacios.")
      .refine((v) => !v.startsWith("/admin") && !v.startsWith("/api") && !v.startsWith("/_next"), "Esa ruta es del sistema.")
      .refine((v) => v.length <= 300, "Hasta 300 caracteres."),
    to_path: z
      .string()
      .trim()
      .refine((v) => /^(\/|https?:\/\/)\S*$/i.test(v), "Tiene que ser una ruta interna (/…) o una URL (https://…).")
      .refine((v) => v.length <= 500, "Hasta 500 caracteres."),
  })
  .refine((r) => r.from_path !== normalizeFromPath(r.to_path) || /^https?:/i.test(r.to_path), {
    message: "El destino no puede ser igual al origen.",
    path: ["to_path"],
  });
export type RedirectInput = z.input<typeof redirectSchema>;
