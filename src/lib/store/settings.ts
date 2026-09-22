import "server-only";

import { unstable_cache } from "next/cache";

import { configureMoney } from "@/lib/money";
import { createPublicClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { parseTheme, type Theme } from "@/lib/theme";

import { asBool, asNumber, asObject, asString, CACHE_REVALIDATE } from "./utils";

export interface CheckoutSettings {
  transfer: {
    enabled: boolean;
    discount_percent: number;
    bank_name: string;
    holder: string;
    cbu: string;
    alias: string;
    cuit: string;
    instructions_md: string;
  };
  whatsapp: { enabled: boolean; message_template: string };
  require_phone: boolean;
  require_address_for_pickup: boolean;
  order_notes_enabled: boolean;
  min_order_total: number;
  /** Horas de reserva de stock de un pedido impago (0 = nunca vence). */
  reservation_hours: number;
}

/** Precio sin impuestos nacionales (spec §13 · P0-15). */
export interface TaxSettings {
  show_net_price: boolean;
  default_vat_percent: number;
  label: string;
}

/** Datos legales AR (P0-16). */
export interface LegalSettings {
  country: string;
  consumer_defense_link: boolean;
  data_fiscal: { image_url: string; href: string };
  cuit: string;
  razon_social: string;
}

/** IDs de integraciones (P0-18). Validados al guardar (H); acá se re-chequea el formato. */
export interface IntegrationSettings {
  ga4_id: string;
  gtm_id: string;
  meta_pixel_id: string;
  google_site_verification: string;
}

/** Botón flotante de WhatsApp (P0-19). */
export interface WhatsAppButtonSettings {
  enabled: boolean;
  position: "left" | "right";
  message_template: string;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
}

export interface FreeShippingBarSettings {
  enabled: boolean;
  /** null = el `free_over` mínimo entre las zonas activas. */
  threshold: number | null;
}

export interface CatalogSettings {
  out_of_stock_display: "show" | "show_last" | "hide";
}

export interface Announcement {
  enabled: boolean;
  text: string;
  href: string;
  bg: string;
  fg: string;
}

export interface StoreSettings
  extends Omit<
    Tables<"store_settings">,
    | "theme"
    | "checkout"
    | "announcement"
    | "social"
    | "seo"
    | "maintenance"
    | "policies"
    | "tax"
    | "legal"
    | "integrations"
    | "whatsapp_button"
    | "free_shipping_bar"
    | "catalog"
  > {
  theme: Theme;
  checkout: CheckoutSettings;
  announcement: Announcement;
  social: Partial<Record<"instagram" | "facebook" | "tiktok" | "x" | "youtube", string>>;
  seo: { title: string; description: string; og_image_url: string };
  maintenance: { enabled: boolean; message: string };
  policies: Partial<Record<"shipping_md" | "returns_md" | "privacy_md" | "terms_md", string>>;
  tax: TaxSettings;
  legal: LegalSettings;
  integrations: IntegrationSettings;
  whatsapp_button: WhatsAppButtonSettings;
  free_shipping_bar: FreeShippingBarSettings;
  catalog: CatalogSettings;
}

export function parseCheckout(value: Json): CheckoutSettings {
  const c = asObject(value);
  const t = asObject(c.transfer);
  const w = asObject(c.whatsapp);
  return {
    transfer: {
      enabled: asBool(t.enabled, true),
      discount_percent: asNumber(t.discount_percent, 0),
      bank_name: asString(t.bank_name),
      holder: asString(t.holder),
      cbu: asString(t.cbu),
      alias: asString(t.alias),
      cuit: asString(t.cuit),
      instructions_md: asString(t.instructions_md),
    },
    whatsapp: { enabled: asBool(w.enabled, true), message_template: asString(w.message_template) },
    require_phone: asBool(c.require_phone, true),
    require_address_for_pickup: asBool(c.require_address_for_pickup, false),
    order_notes_enabled: asBool(c.order_notes_enabled, true),
    min_order_total: asNumber(c.min_order_total, 0),
    reservation_hours: asNumber(c.reservation_hours, 48),
  };
}

function stringRecord<K extends string>(value: Json, keys: readonly K[]): Partial<Record<K, string>> {
  const o = asObject(value);
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = asString(o[k]);
    if (v) out[k] = v;
  }
  return out;
}

/** Devuelve el valor si respeta el formato; si no, "" (nunca se inyecta algo raro en un <script>). */
function idMatching(value: Json | undefined, re: RegExp): string {
  const v = asString(value).trim();
  return re.test(v) ? v : "";
}

export function parseTax(value: Json): TaxSettings {
  const t = asObject(value);
  return {
    show_net_price: asBool(t.show_net_price, false),
    default_vat_percent: asNumber(t.default_vat_percent, 21),
    label: asString(t.label) || "Precio sin impuestos nacionales",
  };
}

export function parseLegal(value: Json): LegalSettings {
  const l = asObject(value);
  const df = asObject(l.data_fiscal);
  return {
    country: asString(l.country, "AR") || "AR",
    consumer_defense_link: asBool(l.consumer_defense_link, true),
    data_fiscal: { image_url: asString(df.image_url), href: asString(df.href) },
    cuit: asString(l.cuit),
    razon_social: asString(l.razon_social),
  };
}

export function parseIntegrations(value: Json): IntegrationSettings {
  const i = asObject(value);
  return {
    ga4_id: idMatching(i.ga4_id, /^G-[A-Z0-9]{4,20}$/i),
    gtm_id: idMatching(i.gtm_id, /^GTM-[A-Z0-9]{4,12}$/i),
    meta_pixel_id: idMatching(i.meta_pixel_id, /^\d{6,20}$/),
    google_site_verification: idMatching(i.google_site_verification, /^[A-Za-z0-9_-]{10,100}$/),
  };
}

export function parseWhatsAppButton(value: Json): WhatsAppButtonSettings {
  const w = asObject(value);
  return {
    enabled: asBool(w.enabled, true),
    position: asString(w.position) === "left" ? "left" : "right",
    message_template: asString(w.message_template),
    show_on_mobile: asBool(w.show_on_mobile, true),
    show_on_desktop: asBool(w.show_on_desktop, true),
  };
}

export function parseFreeShippingBar(value: Json): FreeShippingBarSettings {
  const f = asObject(value);
  const threshold = f.threshold === null || f.threshold === undefined ? null : asNumber(f.threshold, 0);
  return { enabled: asBool(f.enabled, true), threshold: threshold && threshold > 0 ? threshold : null };
}

export function parseCatalog(value: Json): CatalogSettings {
  const d = asString(asObject(value).out_of_stock_display);
  return { out_of_stock_display: d === "show" || d === "hide" ? d : "show_last" };
}

/** Normaliza la fila de `store_settings` (jsonb → tipos). */
export function parseSettings(row: Tables<"store_settings">): StoreSettings {
  const a = asObject(row.announcement);
  const seo = asObject(row.seo);
  const m = asObject(row.maintenance);
  return {
    ...row,
    theme: parseTheme(row.theme),
    checkout: parseCheckout(row.checkout),
    announcement: {
      enabled: asBool(a.enabled, false),
      text: asString(a.text),
      href: asString(a.href),
      bg: asString(a.bg),
      fg: asString(a.fg),
    },
    social: stringRecord(row.social, ["instagram", "facebook", "tiktok", "x", "youtube"] as const),
    seo: { title: asString(seo.title), description: asString(seo.description), og_image_url: asString(seo.og_image_url) },
    maintenance: { enabled: asBool(m.enabled, false), message: asString(m.message) },
    policies: stringRecord(row.policies, ["shipping_md", "returns_md", "privacy_md", "terms_md"] as const),
    tax: parseTax(row.tax),
    legal: parseLegal(row.legal),
    integrations: parseIntegrations(row.integrations),
    whatsapp_button: parseWhatsAppButton(row.whatsapp_button),
    free_shipping_bar: parseFreeShippingBar(row.free_shipping_bar),
    catalog: parseCatalog(row.catalog),
  };
}

/** Lectura SIN cache (checkout: tiene que ser la configuración actual). */
export async function fetchSettingsFresh(): Promise<StoreSettings> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(`No se pudo leer store_settings: ${error?.message ?? "sin fila"}`);
  return parseSettings(data);
}

const getSettingsCached = unstable_cache(
  () => fetchSettingsFresh(),
  ["store-settings"],
  { tags: ["settings"], revalidate: CACHE_REVALIDATE },
);

/** Settings de la tienda (cacheados por tag `settings`). Configura la moneda activa para `roundPrice()`. */
export async function getSettings(): Promise<StoreSettings> {
  const settings = await getSettingsCached();
  configureMoney(settings.currency);
  return settings;
}
