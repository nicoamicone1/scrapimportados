import "server-only";

import { requireAdmin, type Role } from "@/lib/auth";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  is_active: boolean;
  /** Último acceso: el mayor entre `last_seen_at` y el último login de Auth. */
  last_access_at: string | null;
  created_at: string;
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

/** Perfiles del equipo (RPC `admin_list_users`, sólo admin). */
export async function listUsers(): Promise<AdminUser[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: (["owner", "admin", "staff", "pending"].includes(u.role) ? u.role : "pending") as Role,
    is_active: u.is_active,
    last_access_at: latest(u.last_seen_at, u.last_sign_in_at),
    created_at: u.created_at,
  }));
}
