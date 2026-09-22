import "server-only";

import type { AdminContext } from "@/lib/auth";
import { toListItem, type OrderListItem } from "@/lib/admin/orders";
import { sanitizeSearch } from "@/lib/admin/order-utils";
import type { Tables } from "@/lib/supabase/database.types";

/** Lecturas del admin para clientes (sin caché, bajo RLS de admin). */

type Supa = AdminContext["supabase"];

export const CUSTOMERS_PER_PAGE = 50;

export const CUSTOMER_SORTS = {
  recientes: { label: "Más recientes", column: "created_at", ascending: false },
  nombre: { label: "Nombre (A-Z)", column: "name", ascending: true },
  pedidos: { label: "Más pedidos", column: "orders_count", ascending: false },
  gastado: { label: "Más gastado", column: "total_spent", ascending: false },
} as const;
export type CustomerSort = keyof typeof CUSTOMER_SORTS;

export interface CustomerFilters {
  page: number;
  q: string;
  sort: CustomerSort;
  tag: string | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

function one(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseCustomerFilters(sp: SearchParams): CustomerFilters {
  const page = Number.parseInt(one(sp, "page"), 10);
  const orden = one(sp, "orden");
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    q: one(sp, "q").slice(0, 80),
    sort: orden in CUSTOMER_SORTS ? (orden as CustomerSort) : "recientes",
    tag: one(sp, "tag").trim().toLowerCase() || null,
  };
}

export type CustomerRow = Tables<"customers">;

export interface CustomerListItem extends CustomerRow {
  lastOrderAt: string | null;
}

export async function listCustomers(
  supabase: Supa,
  f: CustomerFilters,
): Promise<{ rows: CustomerListItem[]; total: number }> {
  let query = supabase.from("customers").select("*", { count: "exact" });
  const q = sanitizeSearch(f.q);
  if (q) {
    const like = `*${q}*`;
    query = query.or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like},doc_number.ilike.${like}`);
  }
  if (f.tag) query = query.contains("tags", [f.tag]);
  const sort = CUSTOMER_SORTS[f.sort];
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order("id");
  const start = (f.page - 1) * CUSTOMERS_PER_PAGE;
  const { data, count, error } = await query.range(start, start + CUSTOMERS_PER_PAGE - 1);
  if (error) {
    console.error("[customers.list]", error.message);
    return { rows: [], total: 0 };
  }

  const ids = (data ?? []).map((c) => c.id);
  const last = new Map<string, string>();
  if (ids.length) {
    const { data: orders } = await supabase
      .from("orders")
      .select("customer_id, created_at")
      .in("customer_id", ids)
      .order("created_at", { ascending: false })
      .limit(1000);
    for (const o of orders ?? []) {
      if (o.customer_id && !last.has(o.customer_id)) last.set(o.customer_id, o.created_at);
    }
  }
  return {
    rows: (data ?? []).map((c) => ({ ...c, lastOrderAt: last.get(c.id) ?? null })),
    total: count ?? 0,
  };
}

export async function getCustomerDetail(
  supabase: Supa,
  id: string,
): Promise<{ customer: CustomerRow; orders: OrderListItem[]; pending: number } | null> {
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) return null;
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, number, created_at, customer, status, payment_status, payment_method_code, fulfillment, total, currency, expires_at, seen_at, source, order_items(qty)",
    )
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (orders ?? []).map(toListItem);
  const pending = list
    .filter((o) => o.status !== "cancelled" && o.paymentStatus !== "paid" && o.paymentStatus !== "refunded")
    .reduce((s, o) => s + o.total, 0);
  return { customer, orders: list, pending };
}
