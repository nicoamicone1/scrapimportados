import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { parsePlan, type PlanInfo } from "@/lib/plans";
import type { Json, Tables } from "@/lib/supabase/database.types";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type Profile = Tables<"profiles">;
/** Rol dentro de UNA tienda (store_members.role). */
export type Role = "owner" | "admin" | "staff";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueño",
  admin: "Administrador",
  staff: "Staff",
};

/** Cookie con la tienda activa del admin (spec §14.2). */
export const ADMIN_STORE_COOKIE = "ecommy_admin_store";

/** Error de autorización. `runAction()` lo convierte en `fail()`. */
export class AdminError extends Error {
  readonly code: "unauthorized" | "forbidden";
  constructor(code: "unauthorized" | "forbidden" = "unauthorized", message?: string) {
    super(message ?? (code === "forbidden" ? "No tenés permiso para hacer esto." : "No autorizado"));
    this.name = "AdminError";
    this.code = code;
  }
}

export function isAdminRole(role: string | null | undefined): role is Role {
  return role === "owner" || role === "admin" || role === "staff";
}

/** Usuario autenticado (validado contra Auth). `user: null` si no hay sesión. */
export const getSession = cache(async (): Promise<{ supabase: ServerSupabase; user: User | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
});

/** Perfil del usuario actual (o `null`). Memoizado por request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ?? null;
});

/** Tienda activa del admin (fila completa: la ve el equipo por RLS). */
export interface AdminStore {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  owner_id: string | null;
  onboarding: Json;
  created_at: string;
}

export interface Membership {
  role: Role;
  is_active: boolean;
  /** `true` si es un superadmin operando una tienda de la que no es miembro. */
  impersonating: boolean;
}

export interface MyStore extends AdminStore {
  role: Role;
  is_active: boolean;
  plan_code: string | null;
  plan_status: string | null;
  trial_ends_at: string | null;
}

const STORE_COLUMNS = "id, slug, name, status, custom_domain, custom_domain_verified, owner_id, onboarding, created_at";

/**
 * Tiendas donde el usuario es miembro (activas o no), con rol y plan.
 * Excluye las borradas. Memoizado por request.
 */
export const listMyStores = cache(async (): Promise<MyStore[]> => {
  const { supabase, user } = await getSession();
  if (!user) return [];
  const { data, error } = await supabase
    .from("store_members")
    .select(`role, is_active, store:stores(${STORE_COLUMNS}, subscriptions(plan_code, status, trial_ends_at))`)
    .eq("user_id", user.id);
  if (error) throw new Error(`No se pudieron leer tus tiendas: ${error.message}`);
  const out: MyStore[] = [];
  for (const row of data ?? []) {
    const s = row.store;
    if (!s || s.status === "deleted" || !isAdminRole(row.role)) continue;
    const sub = Array.isArray(s.subscriptions) ? s.subscriptions[0] : s.subscriptions;
    out.push({
      id: s.id,
      slug: s.slug,
      name: s.name,
      status: s.status,
      custom_domain: s.custom_domain,
      custom_domain_verified: s.custom_domain_verified,
      owner_id: s.owner_id,
      onboarding: s.onboarding,
      created_at: s.created_at,
      role: row.role,
      is_active: row.is_active,
      plan_code: sub?.plan_code ?? null,
      plan_status: sub?.status ?? null,
      trial_ends_at: sub?.trial_ends_at ?? null,
    });
  }
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at));
});

export interface AdminContext {
  supabase: ServerSupabase;
  user: User;
  profile: Profile;
  /** Tienda activa: TODA lectura/escritura del admin filtra por `store.id`. */
  store: AdminStore;
  membership: Membership;
  plan: PlanInfo;
}

/** Plan efectivo de una tienda (RPC `current_plan`: un trial vencido ya cuenta como Free). */
async function loadPlan(supabase: ServerSupabase, storeId: string): Promise<PlanInfo> {
  const { data, error } = await supabase.rpc("current_plan", { p_store_id: storeId });
  if (error) console.error("[auth] current_plan:", error.message);
  return parsePlan(data);
}

type Resolved =
  | { kind: "ok"; ctx: AdminContext }
  | { kind: "anonymous" }
  | { kind: "no-stores" }
  | { kind: "inactive"; store: MyStore };

/**
 * Resuelve la tienda activa: cookie `ecommy_admin_store` si el usuario es
 * miembro activo (o superadmin); si no, la primera tienda activa donde es
 * miembro. Memoizado por request.
 */
const resolveAdmin = cache(async (): Promise<Resolved> => {
  const { supabase, user } = await getSession();
  if (!user) return { kind: "anonymous" };
  const [profile, stores, cookieStore] = await Promise.all([getProfile(), listMyStores(), cookies()]);
  if (!profile) return { kind: "anonymous" };

  const wanted = cookieStore.get(ADMIN_STORE_COOKIE)?.value ?? null;
  let store: AdminStore | null = null;
  let membership: Membership | null = null;

  const mine = wanted ? stores.find((s) => s.id === wanted) : undefined;
  if (mine && mine.is_active) {
    store = mine;
    membership = { role: mine.role, is_active: true, impersonating: false };
  } else if (wanted && profile.is_platform_admin && !mine) {
    const { data } = await supabase.from("stores").select(STORE_COLUMNS).eq("id", wanted).neq("status", "deleted").maybeSingle();
    if (data) {
      store = data;
      membership = { role: "owner", is_active: true, impersonating: true };
    }
  }
  if (!store) {
    const first = stores.find((s) => s.is_active && s.status === "active") ?? stores.find((s) => s.is_active);
    if (first) {
      store = first;
      membership = { role: first.role, is_active: true, impersonating: false };
    }
  }
  if (!store || !membership) {
    const inactive = stores.find((s) => !s.is_active);
    return inactive ? { kind: "inactive", store: inactive } : { kind: "no-stores" };
  }

  const plan = await loadPlan(supabase, store.id);
  return { kind: "ok", ctx: { supabase, user, profile, store, membership, plan } };
});

/**
 * Contexto del admin para la tienda activa. Lo llama TODA action, lectura
 * y route handler del admin.
 * - Sin sesión → `AdminError('unauthorized')`.
 * - Sin tiendas → redirect a `/app/nueva` (crear la primera).
 * - Con membresía desactivada → `AdminError('forbidden')` (el layout muestra la pantalla de espera).
 */
export async function requireAdmin(): Promise<AdminContext> {
  const resolved = await resolveAdmin();
  if (resolved.kind === "anonymous") throw new AdminError("unauthorized");
  if (resolved.kind === "no-stores") redirect("/app/nueva");
  if (resolved.kind === "inactive") throw new AdminError("forbidden", "Tu acceso a esta tienda está pausado.");
  return resolved.ctx;
}

/** Variante que no redirige ni lanza (layouts que quieren decidir qué mostrar). */
export async function getAdminState(): Promise<Resolved> {
  return resolveAdmin();
}

/** Igual que `requireAdmin` pero sólo para el dueño de la tienda activa. */
export async function requireOwner(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (ctx.membership.role !== "owner") {
    throw new AdminError("forbidden", "Sólo el dueño de la tienda puede hacer esto.");
  }
  return ctx;
}

/** Superadmin de la plataforma (`profiles.is_platform_admin`). */
export async function requirePlatformAdmin(): Promise<{ supabase: ServerSupabase; user: User; profile: Profile }> {
  const { supabase, user } = await getSession();
  if (!user) throw new AdminError("unauthorized");
  const profile = await getProfile();
  if (!profile?.is_platform_admin) throw new AdminError("forbidden", "Sólo para administradores de la plataforma.");
  return { supabase, user, profile };
}

/** Opciones de la cookie de tienda activa (1 año, sólo server). */
export const ADMIN_STORE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
