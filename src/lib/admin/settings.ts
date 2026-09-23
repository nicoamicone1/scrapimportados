import "server-only";

import { requireAdmin } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { parseSettings, type StoreSettings } from "@/lib/store/settings";
import { escapeLike } from "@/lib/store/utils";
import { SCHEMA_VERSION } from "@/lib/version";

/*
 * Lecturas de Configuración para el admin (sin caché, con la sesión del
 * usuario), siempre de la tienda activa. Las escrituras están en
 * src/app/admin/(panel)/configuracion/actions.ts.
 */

export type SettingsRow = Tables<"store_settings">;

/** Fila cruda de `store_settings` de la tienda activa (para mergear jsonb sin perder claves). */
export async function getSettingsRow(): Promise<SettingsRow> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase.from("store_settings").select("*").eq("store_id", store.id).single();
  if (error || !data) throw new Error(`No se pudo leer store_settings: ${error?.message ?? "sin fila"}`);
  return data;
}

/** Configuración normalizada (mismas formas que lee el storefront). */
export async function getAdminSettings(): Promise<StoreSettings> {
  return parseSettings(await getSettingsRow());
}

export interface AdminPaymentMethod {
  id: string;
  code: string;
  type: "transfer" | "whatsapp" | "cash" | "other";
  name: string;
  is_active: boolean;
  discount_percent: number;
  instructions_md: string;
  position: number;
}

export async function listPaymentMethodsAdmin(): Promise<AdminPaymentMethod[]> {
  const { supabase, store } = await requireAdmin();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, code, type, name, is_active, discount_percent, instructions_md, position")
    .eq("store_id", store.id)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    code: m.code,
    type: (["transfer", "whatsapp", "cash"].includes(m.type) ? m.type : "other") as AdminPaymentMethod["type"],
    name: m.name,
    is_active: m.is_active,
    discount_percent: Number(m.discount_percent),
    instructions_md: m.instructions_md ?? "",
    position: m.position,
  }));
}

export type RedirectRow = Tables<"redirects">;

export const REDIRECTS_PER_PAGE = 50;

export async function listRedirects({ q, page }: { q?: string; page: number }): Promise<{ rows: RedirectRow[]; total: number }> {
  const { supabase, store } = await requireAdmin();
  let query = supabase.from("redirects").select("*", { count: "exact" }).eq("store_id", store.id);
  const term = q?.trim();
  if (term) {
    const t = escapeLike(term);
    query = query.or(`from_path.ilike.%${t}%,to_path.ilike.%${t}%`);
  }
  const from = (page - 1) * REDIRECTS_PER_PAGE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + REDIRECTS_PER_PAGE - 1);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0 };
}

export interface SchemaStatus {
  expected: number;
  current: number | null;
  outdated: boolean;
}

/** Compara `app_meta.schema_version` con la versión que espera el código. */
export async function getSchemaStatus(): Promise<SchemaStatus> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("app_meta").select("value").eq("key", "schema_version").maybeSingle();
  const raw = data?.value;
  const current = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : null;
  return { expected: SCHEMA_VERSION, current, outdated: current === null || current < SCHEMA_VERSION };
}
