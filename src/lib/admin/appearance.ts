import "server-only";

import { requireAdmin } from "@/lib/auth";
import type { AnnouncementInput } from "@/lib/schemas/appearance";
import type { Json } from "@/lib/supabase/database.types";
import { parseTheme, themeSchema, type Theme } from "@/lib/theme";

/*
 * Lectura de apariencia para el editor (agente E): tema, marca y barra de
 * anuncio directamente de `store_settings` (sin caché).
 */

export interface AppearanceData {
  theme: Theme;
  /** El tema guardado no pasaba la validación y se normalizó con defaults. */
  themeWasInvalid: boolean;
  brand: { name: string; tagline: string; logo_url: string; favicon_url: string };
  announcement: Required<AnnouncementInput>;
  timezone: string;
  whatsappPhone: string | null;
  social: Record<string, string>;
  contactEmail: string | null;
  address: string | null;
}

function obj(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const s = (v: Json | undefined) => (typeof v === "string" ? v : "");

export async function getAppearanceData(): Promise<AppearanceData> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("store_settings")
    .select("name, tagline, logo_url, favicon_url, announcement, theme, timezone, whatsapp_phone, social, contact_email, address")
    .eq("store_id", store.id)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No hay configuración de la tienda.");
  const theme = parseTheme(data.theme);
  const a = obj(data.announcement);
  const social: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(data.social))) if (typeof v === "string" && v) social[k] = v;
  return {
    theme,
    themeWasInvalid: !themeSchema.safeParse(data.theme).success,
    brand: { name: data.name, tagline: data.tagline ?? "", logo_url: data.logo_url ?? "", favicon_url: data.favicon_url ?? "" },
    announcement: { enabled: a.enabled === true, text: s(a.text), href: s(a.href), bg: s(a.bg), fg: s(a.fg) },
    timezone: data.timezone,
    whatsappPhone: data.whatsapp_phone,
    social,
    contactEmail: data.contact_email,
    address: data.address,
  };
}
