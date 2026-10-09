import "server-only";

import type { TransferSubscription } from "@/lib/admin/transfer";
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

export interface PendingTransfer {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  expired: boolean;
  keep_previous: boolean;
}

/** Lo que necesita "Pasar la tienda a otra persona" (ver `src/lib/admin/transfer.ts`). */
export interface TransferPanel {
  /** Puede pasarla: el titular (`stores.owner_id`) o el superadmin. */
  canTransfer: boolean;
  actorIsTitular: boolean;
  titularId: string | null;
  pending: PendingTransfer | null;
  subscription: TransferSubscription | null;
  /** La tienda ya cambió de titular alguna vez (la prueba de Pro no vuelve a arrancar). */
  alreadyTransferred: boolean;
  /** Cobro de pedidos con Mercado Pago conectado (se desconecta al pasarla). */
  mpSalesConnected: boolean;
}

/** `null` sin la migración 0024 (no existe `store_transfers`): Usuarios no muestra la opción. */
export async function loadTransferPanel(ctx: AdminContext): Promise<TransferPanel | null> {
  const { supabase, store, user, profile, membership } = ctx;
  const actorIsTitular = store.owner_id === user.id;
  const canTransfer = membership.role === "owner" && (actorIsTitular || profile.is_platform_admin);
  const base: TransferPanel = {
    canTransfer,
    actorIsTitular,
    titularId: store.owner_id,
    pending: null,
    subscription: null,
    alreadyTransferred: false,
    mpSalesConnected: false,
  };
  if (!canTransfer) return base;

  const [transfers, sub, mp] = await Promise.all([
    supabase
      .from("store_transfers")
      .select("id, to_email, token, expires_at, keep_previous, status")
      .eq("store_id", store.id)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("subscriptions")
      .select("plan_code, status, trial_ends_at, provider, provider_ref, provider_status, last_payment_at")
      .eq("store_id", store.id)
      .maybeSingle(),
    supabase.rpc("store_payment_account_status", { p_store_id: store.id }),
  ]);
  if (transfers.error?.code === "PGRST205") return null;
  if (transfers.error) console.error("[transfer] store_transfers:", transfers.error.message);
  if (sub.error) console.error("[transfer] subscriptions:", sub.error.message);

  const rows = transfers.data ?? [];
  const p = rows.find((r) => r.status === "pending" && r.token);
  const mpStatus = mp.data && typeof mp.data === "object" && !Array.isArray(mp.data) ? (mp.data as { status?: unknown }).status : null;
  return {
    ...base,
    pending: p
      ? {
          id: p.id,
          email: p.to_email,
          token: p.token as string,
          expires_at: p.expires_at,
          expired: new Date(p.expires_at).getTime() < Date.now(),
          keep_previous: p.keep_previous,
        }
      : null,
    subscription: sub.data ?? null,
    alreadyTransferred: rows.some((r) => r.status === "accepted"),
    mpSalesConnected: mpStatus === "connected",
  };
}
