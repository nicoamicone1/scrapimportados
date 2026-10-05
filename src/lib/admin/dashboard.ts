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
import { amountPaid, balanceDue, hasReservation } from "@/lib/admin/order-utils";
import { orderPublicUrl, toListItem, type OrderListItem, type StoreInfo } from "@/lib/admin/orders";
import { toWhatsAppNumber, whatsAppTemplateFor } from "@/lib/admin/whatsapp";
import { prioritizeWorkQueue, WORK_QUEUE_LIMIT, type WorkQueueItem } from "@/lib/admin/work-queue";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/database.types";
import type { StoreUrlTarget } from "@/lib/tenant/urls";

/**
 * Lecturas del dashboard del admin (sin caché). La tienda sale de
 * `store.storeId` (lo completa `getStoreInfo()`): toda consulta filtra por ella.
 */

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

async function series(supabase: Supa, storeId: string, from: Date, to: Date, bucket: "hour" | "day", tz: string) {
  const { data, error } = await supabase.rpc("admin_sales_series", {
    p_store_id: storeId,
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
  const sid = store.storeId;
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
    series(supabase, sid, period.from, period.to, period.bucket, tz),
    series(supabase, sid, period.prevFrom, period.prevTo, "day", tz),
    supabase
      .from("orders")
      .select("id, total, payment_status")
      .eq("store_id", sid)
      .neq("status", "cancelled")
      .in("payment_status", ["pending", "partial"])
      .limit(1000),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", sid).eq("status", "pending"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", sid)
      .in("status", ["confirmed", "preparing"]),
    supabase.from("orders").select(LIST_COLUMNS).eq("store_id", sid).order("created_at", { ascending: false }).limit(8),
    supabase
      .from("orders")
      .select(LIST_COLUMNS)
      .eq("store_id", sid)
      .eq("status", "pending")
      .eq("payment_status", "pending")
      .not("expires_at", "is", null)
      .order("expires_at", { ascending: true })
      .limit(6),
    supabase
      .from("low_stock_variants")
      .select("*", { count: "exact" })
      .eq("store_id", sid)
      .order("stock")
      .order("product_name")
      .limit(8),
    supabase.rpc("admin_top_products", {
      p_store_id: sid,
      p_from: period.from.toISOString(),
      p_to: period.to.toISOString(),
      p_limit: 5,
    }),
    supabase
      .from("withdrawal_requests")
      .select("id, code, name, order_number, created_at", { count: "exact" })
      .eq("store_id", sid)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", sid),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", sid).eq("status", "active"),
    supabase.from("shipping_zones").select("id", { count: "exact", head: true }).eq("store_id", sid).eq("is_active", true),
    supabase.from("pickup_locations").select("id", { count: "exact", head: true }).eq("store_id", sid).eq("is_active", true),
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
    ? await supabase.from("order_payments").select("order_id, amount").eq("store_id", sid).in("order_id", partialIds)
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

// ---------------------------------------------------------------------
// "Resolver desde acá": la cola de trabajo del inicio
// ---------------------------------------------------------------------

export interface WorkQueue {
  items: WorkQueueItem[];
  /** Pedidos accionables en total (por confirmar + por preparar/despachar). */
  total: number;
}

const QUEUE_COLUMNS = `${LIST_COLUMNS}, public_token, pickup_location_id, customer_id`;

/**
 * Pedidos que se pueden resolver desde el inicio (PRODUCT-THESIS §4.1):
 * pendientes primero, después confirmados y en preparación
 * (`prioritizeWorkQueue`). Cada fila trae el contexto de WhatsApp armado igual
 * que la ficha del pedido (link público, alias/CBU, saldo, retiro y reserva),
 * así el cliente abre el mensaje sin otra consulta.
 */
export async function getWorkQueue(
  supabase: Supa,
  store: StoreInfo,
  target: StoreUrlTarget,
  limit: number = WORK_QUEUE_LIMIT,
): Promise<WorkQueue> {
  const sid = store.storeId;
  // Traemos de más en cada grupo para que el orden fino (reservas que vencen) lo decida la lógica pura.
  const fetchSize = limit * 2;
  const [pending, fulfil] = await Promise.all([
    supabase
      .from("orders")
      .select(QUEUE_COLUMNS, { count: "exact" })
      .eq("store_id", sid)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(fetchSize),
    supabase
      .from("orders")
      .select(QUEUE_COLUMNS, { count: "exact" })
      .eq("store_id", sid)
      .in("status", ["confirmed", "preparing"])
      .order("created_at", { ascending: true })
      .limit(fetchSize),
  ]);
  if (pending.error) console.error("[dashboard.workQueue]", pending.error.message);
  if (fulfil.error) console.error("[dashboard.workQueue]", fulfil.error.message);

  const rows = [...(pending.data ?? []), ...(fulfil.data ?? [])];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const picked = prioritizeWorkQueue(rows.map(toListItem), limit);
  const pickedRows = picked.map((o) => byId.get(o.id)!);

  // Saldo de los pagos parciales, retiro y teléfono de la ficha del cliente (si el snapshot no lo tiene).
  const partialIds = picked.filter((o) => o.paymentStatus === "partial").map((o) => o.id);
  const pickupIds = [...new Set(pickedRows.map((r) => r.pickup_location_id).filter((v): v is string => Boolean(v)))];
  const customerIds = [
    ...new Set(
      pickedRows
        .filter((r, i) => !picked[i].customer.phone && r.customer_id)
        .map((r) => r.customer_id as string),
    ),
  ];
  const [payments, pickups, customers] = await Promise.all([
    partialIds.length
      ? supabase.from("order_payments").select("order_id, amount").eq("store_id", sid).in("order_id", partialIds)
      : Promise.resolve({ data: [] as { order_id: string; amount: number }[] }),
    pickupIds.length
      ? supabase.from("pickup_locations").select("id, name, address, hours_text").eq("store_id", sid).in("id", pickupIds)
      : Promise.resolve({ data: [] as Pick<Tables<"pickup_locations">, "id" | "name" | "address" | "hours_text">[] }),
    customerIds.length
      ? supabase.from("customers").select("id, phone").eq("store_id", sid).in("id", customerIds)
      : Promise.resolve({ data: [] as Pick<Tables<"customers">, "id" | "phone">[] }),
  ]);
  const pickupById = new Map((pickups.data ?? []).map((p) => [p.id, p]));
  const phoneByCustomer = new Map((customers.data ?? []).map((c) => [c.id, c.phone]));

  const items = picked.map((o, i): WorkQueueItem => {
    const row = pickedRows[i];
    const phone = o.customer.phone ?? (row.customer_id ? (phoneByCustomer.get(row.customer_id) ?? null) : null);
    if (!phone || !toWhatsAppNumber(phone)) return { ...o, whatsApp: null };

    const money = (v: number) => formatMoney(v, { currency: o.currency });
    const paid = o.paymentStatus === "partial" ? amountPaid((payments.data ?? []).filter((p) => p.order_id === o.id)) : 0;
    const balance = balanceDue(o.total, paid);
    const pickup = row.pickup_location_id ? pickupById.get(row.pickup_location_id) : undefined;
    const reservation = hasReservation({ status: o.status, payment_status: o.paymentStatus, expires_at: o.expiresAt });
    return {
      ...o,
      whatsApp: {
        phone,
        kind: whatsAppTemplateFor({ status: o.status, payment_status: o.paymentStatus, fulfillment: o.fulfillment }),
        context: {
          storeName: store.name,
          customerName: o.customer.name,
          number: o.number,
          total: money(o.total),
          balance: balance > 0 && balance !== o.total ? money(balance) : null,
          orderUrl: orderPublicUrl(target, row.public_token),
          tracking: null,
          pickup: pickup ? { name: pickup.name, address: pickup.address, hours: pickup.hours_text } : null,
          transfer: { alias: store.transfer.alias, cbu: store.transfer.cbu },
          paymentMethodCode: o.paymentMethodCode,
          expiresLabel: reservation && o.expiresAt ? formatDateTime(o.expiresAt, store.timezone) : null,
        },
      },
    };
  });

  return { items, total: (pending.count ?? 0) + (fulfil.count ?? 0) };
}
