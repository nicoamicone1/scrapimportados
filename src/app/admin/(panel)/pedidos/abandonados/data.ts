import "server-only";

import type { AdminContext } from "@/lib/auth";
import { isMissingSchemaError } from "@/lib/store/checkout-sessions";
import type { Json } from "@/lib/supabase/database.types";

/*
 * Bandeja de carritos abandonados (migración 0020). Lee `checkout_sessions`
 * con la sesión del admin (RLS: equipo de la tienda; sin token ni hash de IP).
 */

export const ABANDONED_PER_PAGE = 50;

export type AbandonedFilter = "todos" | "pendientes" | "avisados" | "recuperados" | "bajas";
export type AbandonedStatus = "pending" | "reminded" | "recovered" | "unsubscribed";

export interface AbandonedRow {
  id: string;
  email: string;
  name: string | null;
  items: { name: string; qty: number }[];
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  remindedAt: string | null;
  status: AbandonedStatus;
  order: { id: string; number: number } | null;
}

export interface AbandonedList {
  /** false = falta la migración 0020. */
  available: boolean;
  items: AbandonedRow[];
  total: number;
  /** Últimos 30 días: carritos guardados y recuperados. */
  last30: { sessions: number; recovered: number };
}

/** Estado para la bandeja (la baja manda sobre el aviso; el pedido, sobre todo). */
export function abandonedStatus(row: { recovered_order_id: string | null; unsubscribed_at: string | null; reminded_at: string | null }): AbandonedStatus {
  if (row.recovered_order_id) return "recovered";
  if (row.unsubscribed_at) return "unsubscribed";
  if (row.reminded_at) return "reminded";
  return "pending";
}

function itemsOf(value: Json): { name: string; qty: number }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const i = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const name = typeof i.name === "string" ? i.name : "";
    const qty = Number(i.qty);
    return name && Number.isFinite(qty) && qty > 0 ? [{ name, qty }] : [];
  });
}

export async function listAbandoned(ctx: Pick<AdminContext, "supabase" | "store">, filter: AbandonedFilter, page: number): Promise<AbandonedList> {
  const { supabase, store } = ctx;
  const from = (page - 1) * ABANDONED_PER_PAGE;
  let query = supabase
    .from("checkout_sessions")
    .select("id, email, name, items, subtotal, created_at, updated_at, reminded_at, unsubscribed_at, recovered_order_id, orders(id, number)", {
      count: "exact",
    })
    .eq("store_id", store.id);
  if (filter === "pendientes") query = query.is("recovered_order_id", null).is("unsubscribed_at", null).is("reminded_at", null);
  else if (filter === "avisados") query = query.is("recovered_order_id", null).is("unsubscribed_at", null).not("reminded_at", "is", null);
  else if (filter === "recuperados") query = query.not("recovered_order_id", "is", null);
  else if (filter === "bajas") query = query.is("recovered_order_id", null).not("unsubscribed_at", "is", null);

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [list, sessions, recovered] = await Promise.all([
    query.order("updated_at", { ascending: false }).order("id").range(from, from + ABANDONED_PER_PAGE - 1),
    supabase.from("checkout_sessions").select("id", head).eq("store_id", store.id).gte("created_at", since),
    supabase.from("checkout_sessions").select("id", head).eq("store_id", store.id).gte("created_at", since).not("recovered_order_id", "is", null),
  ]);
  if (list.error) {
    if (isMissingSchemaError(list.error)) return { available: false, items: [], total: 0, last30: { sessions: 0, recovered: 0 } };
    throw new Error(list.error.message);
  }
  const items: AbandonedRow[] = (list.data ?? []).map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    items: itemsOf(s.items),
    subtotal: Number(s.subtotal),
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    remindedAt: s.reminded_at,
    status: abandonedStatus(s),
    order: s.orders ? { id: s.orders.id, number: Number(s.orders.number) } : null,
  }));
  return {
    available: true,
    items,
    total: list.count ?? 0,
    last30: { sessions: sessions.count ?? 0, recovered: recovered.count ?? 0 },
  };
}
