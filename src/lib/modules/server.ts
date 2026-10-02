import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminError, type AdminContext } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

import { hasModule, isModuleCode, isModuleLive, isModuleStatus, MODULES, type ModuleCode, type ModuleStatus } from "./registry";

export { hasModule } from "./registry";

type Db = SupabaseClient<Database>;

/** App vigente de una tienda (`active` o `trial` sin vencer). */
export interface ActiveModule {
  code: ModuleCode;
  status: "active" | "trial";
  activatedAt: string;
  /** `null` = sin vencimiento. */
  expiresAt: string | null;
}

/** Fila de `store_modules` tal cual (incluye desactivadas y vencidas). */
export interface StoreModuleRow {
  code: ModuleCode;
  status: ModuleStatus;
  activatedAt: string;
  expiresAt: string | null;
  notes: string | null;
  updatedAt: string | null;
  /** `status` activo/prueba y sin vencer. */
  live: boolean;
}

/** Ficha comercial de una app (`public.modules` + registro). */
export interface ModuleCatalogEntry {
  code: ModuleCode;
  name: string;
  tagline: string;
  descriptionMd: string;
  /** Precio informativo mensual (se cobra por fuera). `null` = sin precio cargado. */
  priceMonthly: number | null;
  isPublic: boolean;
  position: number;
}

let warnedMissing = false;

/**
 * Hasta que se aplique la migración 0022 las tablas no existen: el admin
 * sigue andando sin apps. Se loguea una sola vez por proceso.
 */
function warnOnce(where: string, message: string) {
  if (warnedMissing) return;
  warnedMissing = true;
  console.error(`[modules] ${where}: ${message} (¿falta aplicar la migración 0022?)`);
}

/** Todas las filas de `store_modules` de la tienda (códigos que el código no conoce se descartan). */
export async function listStoreModuleRows(supabase: Db, storeId: string, now: Date = new Date()): Promise<StoreModuleRow[]> {
  const { data, error } = await supabase
    .from("store_modules")
    .select("module_code, status, activated_at, expires_at, notes, updated_at")
    .eq("store_id", storeId);
  if (error) {
    warnOnce("store_modules", error.message);
    return [];
  }
  const out: StoreModuleRow[] = [];
  for (const r of data ?? []) {
    if (!isModuleCode(r.module_code) || !isModuleStatus(r.status)) continue;
    out.push({
      code: r.module_code,
      status: r.status,
      activatedAt: r.activated_at,
      expiresAt: r.expires_at,
      notes: r.notes,
      updatedAt: r.updated_at,
      live: isModuleLive(r, now),
    });
  }
  return out;
}

/** Apps vigentes de la tienda (activas o en prueba sin vencer). Si la tabla no existe todavía → `[]`. */
export async function getStoreModules(supabase: Db, storeId: string): Promise<ActiveModule[]> {
  const rows = await listStoreModuleRows(supabase, storeId);
  return rows
    .filter((r): r is StoreModuleRow & { status: "active" | "trial" } => r.live && r.status !== "disabled")
    .map((r) => ({ code: r.code, status: r.status, activatedAt: r.activatedAt, expiresAt: r.expiresAt }));
}

/**
 * Catálogo de apps: filas de `public.modules` que el código conoce, en su
 * `position`. Sin la tabla, cae al registro (sin precio) para que la
 * página no quede vacía.
 */
export async function listModuleCatalog(supabase: Db, opts: { includeHidden?: boolean } = {}): Promise<ModuleCatalogEntry[]> {
  const { data, error } = await supabase.from("modules").select("code, name, tagline, description_md, price_monthly, is_public, position").order("position");
  if (error) {
    warnOnce("modules", error.message);
    return Object.values(MODULES).map((m, i) => ({
      code: m.code,
      name: m.name,
      tagline: m.tagline,
      descriptionMd: "",
      priceMonthly: null,
      isPublic: true,
      position: i,
    }));
  }
  const out: ModuleCatalogEntry[] = [];
  for (const r of data ?? []) {
    if (!isModuleCode(r.code)) continue;
    if (!r.is_public && !opts.includeHidden) continue;
    out.push({
      code: r.code,
      name: r.name,
      tagline: r.tagline,
      descriptionMd: r.description_md ?? "",
      priceMonthly: r.price_monthly === null ? null : Number(r.price_monthly),
      isPublic: r.is_public,
      position: r.position,
    });
  }
  return out;
}

/** ¿Ya están las tablas de apps (migración 0022)? Para avisarle al superadmin. */
export async function modulesTablesReady(supabase: Db): Promise<boolean> {
  const { error } = await supabase.from("modules").select("code").limit(1);
  return !error;
}

/**
 * Corta una action o lectura del admin si la tienda no tiene la app.
 *
 *   const ctx = await requireAdmin();
 *   requireModule(ctx, "print3d");
 */
export function requireModule(ctx: Pick<AdminContext, "modules">, code: ModuleCode): void {
  if (!hasModule(ctx, code)) throw new AdminError("forbidden", "Esta app no está activa en tu tienda.");
}
