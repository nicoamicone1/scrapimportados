import "server-only";

import type { AdminContext } from "@/lib/auth";
import {
  compare,
  fillSeries,
  resolvePeriod,
  sumSeries,
  type Comparison,
  type PeriodKey,
  type ResolvedPeriod,
  type SeriesPoint,
} from "@/lib/admin/dashboard-utils";
import { amountPaid } from "@/lib/admin/order-utils";
import { toListItem, type OrderListItem, type StoreInfo } from "@/lib/admin/orders";
import type { Tables } from "@/lib/supabase/database.types";

/** Lecturas del dashboard del admin (sin caché). */

type Supa = AdminContext["supabase"];

export interface DashboardData {
  period: ResolvedPeriod;
  series: SeriesPoint[];
  sales: { value: number; comparison: Comparison };
  orders: { value: number; comparison: Comparison };
  ticket: { value: number; comparison: Comparison };
  unpaid: { count: number; amount: number };
  actionCounts: { toConfirm: number; toShip: number; unpaid: number };
  recent: OrderListItem[];
  expiring: OrderListItem[];
  lowStock: { rows: Tables<"low_stock_variants">[]; total: number };
  topProducts: { productId: string | null; name: string; imageUrl: string | null; qty: number; revenue: number }[];
  withdrawals: { rows: Pick<Tables<"withdrawal_requests">, "id" | "code" | "name" | "order_number" | "created_at">[]; total: number };
  totalOrders: number;
  onboarding: { products: number; transferReady: boolean; shippingReady: boolean };
}

const LIST_COLUMNS =
  "id, number, created_at, customer, status, payment_status, payment_method_code, fulfillment, total, currency, expires_at, seen_at, source, order_items(qty)";

async function series(supabase: Supa, from: Date, to: Date, bucket: "hour" | "day", tz: string) {
  const { data, error } = await supabase.rpc("admin_sales_series", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_bucket: bucket,
    p_tz: tz,
  });
  if (error) console.error("[dashboard.series]", error.message);
  return (data ?? []).map((r) => ({ bucket: r.bucket, orders: Number(r.orders), sales: Number(r.sales) }));
}

export async function getDashboard(
  supabase: Supa,
  key: PeriodKey,
  store: StoreInfo,
  now: Date = new Date(),
): Promise<DashboardData> {
  const tz = store.timezone;
  const period = resolvePeriod(key, now, tz);

  const [
    current,
    previous,
    unpaidRows,
    toConfirm,
    toShip,
    recent,
    expiring,
    lowStock,
    top,
    withdrawals,
    totalOrders,
    products,
    zones,
    pickups,
  ] = await Promise.all([
    series(supabase, period.from, period.to, period.bucket, tz),
    series(supabase, period.prevFrom, period.prevTo, "day", tz),
    supabase
      .from("orders")
      .select("id, total, payment_status")
      .neq("status", "cancelled")
      .in("payment_status", ["pending", "partial"])
      .limit(1000),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["confirmed", "preparing"]),
    supabase.from("orders").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(8),
    supabase
      .from("orders")
      .select(LIST_COLUMNS)
      .eq("status", "pending")
      .eq("payment_status", "pending")
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: true })
      .limit(6),
    supabase.from("low_stock_variants").select("*", { count: "exact" }).order("stock").order("product_name").limit(8),
    supabase.rpc("admin_top_products", { p_from: period.from.toISOString(), p_to: period.to.toISOString(), p_limit: 5 }),
    supabase
      .from("withdrawal_requests")
      .select("id, code, name, order_number, created_at", { count: "exact" })
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("shipping_zones").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("pickup_locations").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const points = fillSeries(period.buckets, current, period.bucket);
  const cur = sumSeries(current);
  const prev = sumSeries(previous);
  const ticketCur = cur.orders ? cur.sales / cur.orders : 0;
  const ticketPrev = prev.orders ? prev.sales / prev.orders : 0;

  // Por cobrar: total de impagos + saldo de los parciales.
  const unpaidList = unpaidRows.data ?? [];
  const partialIds = unpaidList.filter((o) => o.payment_status === "partial").map((o) => o.id);
  const { data: partialPayments } = partialIds.length
    ? await supabase.from("order_payments").select("order_id, amount").in("order_id", partialIds)
    : { data: [] as { order_id: string; amount: number }[] };
  const unpaidAmount = unpaidList.reduce((sum, o) => {
    const paid = o.payment_status === "partial" ? amountPaid((partialPayments ?? []).filter((p) => p.order_id === o.id)) : 0;
    return sum + Math.max(0, Number(o.total) - paid);
  }, 0);

  return {
    period,
    series: points,
    sales: { value: cur.sales, comparison: compare(cur.sales, prev.sales, period.previousLabel) },
    orders: { value: cur.orders, comparison: compare(cur.orders, prev.orders, period.previousLabel) },
    ticket: { value: ticketCur, comparison: compare(ticketCur, ticketPrev, period.previousLabel) },
    unpaid: { count: unpaidList.length, amount: unpaidAmount },
    actionCounts: { toConfirm: toConfirm.count ?? 0, toShip: toShip.count ?? 0, unpaid: unpaidList.length },
    recent: (recent.data ?? []).map(toListItem),
    expiring: (expiring.data ?? []).map(toListItem),
    lowStock: { rows: lowStock.data ?? [], total: lowStock.count ?? 0 },
    topProducts: (top.data ?? []).map((t) => ({
      productId: t.product_id,
      name: t.name,
      imageUrl: t.image_url,
      qty: Number(t.qty),
      revenue: Number(t.revenue),
    })),
    withdrawals: { rows: withdrawals.data ?? [], total: withdrawals.count ?? 0 },
    totalOrders: totalOrders.count ?? 0,
    onboarding: {
      products: products.count ?? 0,
      transferReady: Boolean(store.transfer.alias || store.transfer.cbu),
      shippingReady: (zones.count ?? 0) + (pickups.count ?? 0) > 0,
    },
  };
}
