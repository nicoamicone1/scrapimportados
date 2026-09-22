import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type Profile = Tables<"profiles">;
export type Role = "owner" | "admin" | "staff" | "pending";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dueño",
  admin: "Administrador",
  staff: "Staff",
  pending: "Pendiente",
};

/** Error de autorización. `runAction()` lo convierte en `fail()`. */
export class AdminError extends Error {
  readonly code: "unauthorized" | "forbidden";
  constructor(code: "unauthorized" | "forbidden" = "unauthorized", message?: string) {
    super(message ?? (code === "forbidden" ? "No tenés permiso para hacer esto." : "No autorizado"));
    this.name = "AdminError";
    this.code = code;
  }
}

export function isAdminRole(role: string | null | undefined): role is "owner" | "admin" | "staff" {
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

export interface AdminContext {
  supabase: ServerSupabase;
  user: User;
  profile: Profile;
}

/**
 * Exige un perfil activo con rol owner/admin/staff. Lo llama TODA action y
 * toda lectura del admin. Lanza `AdminError` si no corresponde.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const { supabase, user } = await getSession();
  if (!user) throw new AdminError("unauthorized");
  const profile = await getProfile();
  if (!profile || !profile.is_active || !isAdminRole(profile.role)) {
    throw new AdminError("forbidden");
  }
  return { supabase, user, profile };
}

/** Igual que `requireAdmin` pero sólo para el dueño. */
export async function requireOwner(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (ctx.profile.role !== "owner") {
    throw new AdminError("forbidden", "Sólo el dueño de la tienda puede hacer esto.");
  }
  return ctx;
}
