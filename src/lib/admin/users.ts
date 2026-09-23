import "server-only";

import { isAdminRole, requireAdmin, type AdminContext, type Role } from "@/lib/auth";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  is_active: boolean;
  /** Último acceso: el mayor entre `last_seen_at` y el último login de Auth. */
  last_access_at: string | null;
  /** Alta en ESTA tienda. */
  created_at: string;
}

export interface StoreInvite {
  id: string;
  email: string;
  role: "admin" | "staff";
  token: string;
  expires_at: string;
  expired: boolean;
  created_at: string;
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** Equipo de la tienda activa (RPC `admin_list_users(p_store_id)` sobre store_members). */
export async function listUsers(ctx?: AdminContext): Promise<AdminUser[]> {
  const { supabase, store } = ctx ?? (await requireAdmin());
  const { data, error } = await supabase.rpc("admin_list_users", { p_store_id: store.id });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((u) => isAdminRole(u.role))
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as Role,
      is_active: u.is_active,
      last_access_at: latest(u.last_seen_at, u.last_sign_in_at),
      created_at: u.created_at,
    }));
}

/** Invitaciones pendientes (la RLS sólo se las muestra al dueño). */
export async function listInvites(ctx?: AdminContext): Promise<StoreInvite[]> {
  const { supabase, store } = ctx ?? (await requireAdmin());
  const { data, error } = await supabase
    .from("store_invites")
    .select("id, email, role, token, expires_at, created_at")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const now = Date.now();
  return (data ?? []).map((i) => ({
    ...i,
    role: i.role === "admin" ? "admin" : "staff",
    expired: new Date(i.expires_at).getTime() < now,
  }));
}
