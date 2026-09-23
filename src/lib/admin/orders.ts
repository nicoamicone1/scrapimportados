import "server-only";

import { requireAdmin, type AdminContext } from "@/lib/auth";
import { ymdToZonedStart, addZonedDays } from "@/lib/admin/dashboard-utils";
import {
  isOrderStatus,
  isPaymentStatus,
  parseCustomerSnapshot,
  parseOrderNumber,
  sanitizeSearch,
  type CustomerSnapshot,
  type OrderStatus,
} from "@/lib/admin/order-utils";
import { parseCheckout } from "@/lib/store/settings";
import type { Tables } from "@/lib/supabase/database.types";
import { storeUrl, type StoreUrlTarget } from "@/lib/tenant/urls";

/**
 * Lecturas del admin para pedidos (sin caché; siempre bajo RLS de admin).
 * Toda consulta filtra por la tienda activa (`storeId`).
 */

type Supa = AdminContext["supabase"];

export const ORDERS_PER_PAGE = 50;

/** Tienda activa si el caller no la pasa (firmas que usa el dashboard). */
async function activeStoreId(storeId?: string): Promise<string> {
  return storeId ?? (await requireAdmin()).store.id;
}

// ---------------------------------------------------------------------
// Tienda
// ---------------------------------------------------------------------

export interface StoreInfo {
  /** Tienda a la que pertenecen estos datos. */
  storeId: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
  currency: string;
  locale: string;
  timezone: string;
  inventoryPolicy: "on_order" | "on_paid";
  lowStockThreshold: number;
  reservationHours: number;
  transfer: { alias: string; cbu: string; bankName: string; holder: string };
}

/** Datos de la tienda para pedidos. Sin `storeId` usa la tienda activa del panel. */
export async function getStoreInfo(supabase: Supa, storeId?: string): Promise<StoreInfo> {
  const sid = await activeStoreId(storeId);
  const { data } = await supabase.from("store_settings").select("*").eq("store_id", sid).maybeSingle();
  const checkout = parseCheckout(data?.checkout ?? {});
  const raw = data?.checkout && typeof data.checkout === "object" && !Array.isArray(data.checkout) ? data.checkout : {};
  const hours = Number((raw as Record<string, unknown>).reservation_hours ?? 48);
  return {
    storeId: sid,
    name: data?.name ?? "Tienda",
    logoUrl: data?.logo_url || null,
    address: data?.address || null,
    contactPhone: data?.contact_phone || null,
    contactEmail: data?.contact_email || null,
    whatsappPhone: data?.whatsapp_phone || null,
    currency: data?.currency ?? "ARS",
    locale: data?.locale ?? "es-AR",
    timezone: data?.timezone ?? "America/Argentina/Buenos_Aires",
    inventoryPolicy: data?.inventory_policy === "on_paid" ? "on_paid" : "on_order",
    lowStockThreshold: data?.low_stock_threshold ?? 5,
    reservationHours: Number.isFinite(hours) ? hours : 48,
    transfer: {
      alias: checkout.transfer.alias,
      cbu: checkout.transfer.cbu,
      bankName: checkout.transfer.bank_name,
      holder: checkout.transfer.holder,
    },
  };
}

export function orderPublicPath(token: string): string {
  return `/pedido/${token}`;
}

/** URL pública ABSOLUTA del pedido en la tienda (WhatsApp, remitos, QR, "Ver como cliente"). */
export function orderPublicUrl(store: StoreUrlTarget, token: string): string {
  return storeUrl(store, orderPublicPath(token));
}

// ---------------------------------------------------------------------
// Métodos de pago / retiro / zonas (para selects y etiquetas)
// ---------------------------------------------------------------------

export interface PaymentMethodOption {
  code: string;
  name: string;
  discountPercent: number;
  isActive: boolean;
}

export async function listPaymentMethods(supabase: Supa, storeId: string): Promise<PaymentMethodOption[]> {
  const { data } = await supabase
    .from("payment_methods")
    .select("code, name, discount_percent, is_active, position")
    .eq("store_id", storeId)
    .order("position");
  return (data ?? []).map((m) => ({
    code: m.code,
    name: m.name,
    discountPercent: Number(m.discount_percent),
    isActive: m.is_active,
  }));
}

export function paymentMethodName(methods: readonly PaymentMethodOption[], code: string | null | undefined): string {
  if (!code) return "Sin método";
  return methods.find((m) => m.code === code)?.name ?? code;
}

// ---------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------

export const ORDER_TABS = ["todos", "pendientes", "preparar", "enviados", "cancelados"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_TAB_LABELS: Record<OrderTab, string> = {
  todos: "Todos",
  pendientes: "Pendientes",
  preparar: "Por preparar",
  enviados: "Enviados",
  cancelados: "Cancelados",
};

const TAB_STATUSES: Record<OrderTab, OrderStatus[] | null> = {
  todos: null,
  pendientes: ["pending"],
  preparar: ["confirmed", "preparing"],
  enviados: ["shipped"],
  cancelados: ["cancelled"],
};

export const ORDER_SORTS = {
  recientes: { label: "Más recientes", column: "created_at", ascending: false },
  antiguos: { label: "Más antiguos", column: "created_at", ascending: true },
  "total-desc": { label: "Mayor total", column: "total", ascending: false },
  "total-asc": { label: "Menor total", column: "total", ascending: true },
} as const;
export type OrderSort = keyof typeof ORDER_SORTS;

export interface OrderFilters {
  page: number;
  q: string;
  tab: OrderTab;
  status: OrderStatus | null;
  payment: string | null;
  method: string | null;
  fulfillment: "delivery" | "pickup" | null;
  from: string | null;
  to: string | null;
  sort: OrderSort;
}

type SearchParams = Record<string, string | string[] | undefined>;

function one(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseOrderFilters(sp: SearchParams): OrderFilters {
  const tab = one(sp, "tab");
  const estado = one(sp, "estado");
  const pago = one(sp, "pago");
  const entrega = one(sp, "entrega");
  const orden = one(sp, "orden");
  const page = Number.parseInt(one(sp, "page"), 10);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    q: one(sp, "q").slice(0, 80),
    tab: (ORDER_TABS as readonly string[]).includes(tab) ? (tab as OrderTab) : "todos",
    status: isOrderStatus(estado) ? estado : null,
    payment: isPaymentStatus(pago) || pago === "impago" ? pago : null,
    method: one(sp, "metodo") || null,
    fulfillment: entrega === "envio" ? "delivery" : entrega === "retiro" ? "pickup" : null,
    from: /^\d{4}-\d{2}-\d{2}$/.test(one(sp, "desde")) ? one(sp, "desde") : null,
    to: /^\d{4}-\d{2}-\d{2}$/.test(one(sp, "hasta")) ? one(sp, "hasta") : null,
    sort: orden in ORDER_SORTS ? (orden as OrderSort) : "recientes",
  };
}

export function hasActiveFilters(f: OrderFilters): boolean {
  return Boolean(f.q || f.status || f.payment || f.method || f.fulfillment || f.from || f.to);
}

export interface OrderListItem {
  id: string;
  number: number;
  createdAt: string;
  customer: CustomerSnapshot;
  status: string;
  paymentStatus: string;
  paymentMethodCode: string | null;
  fulfillment: string;
  total: number;
  currency: string;
  expiresAt: string | null;
  seenAt: string | null;
  itemsCount: number;
  source: string;
}

const LIST_COLUMNS =
  "id, number, created_at, customer, status, payment_status, payment_method_code, fulfillment, total, currency, expires_at, seen_at, source, order_items(qty)";

type ListRow = Pick<
  Tables<"orders">,
  | "id"
  | "number"
  | "created_at"
  | "customer"
  | "status"
  | "payment_status"
  | "payment_method_code"
  | "fulfillment"
  | "total"
  | "currency"
  | "expires_at"
  | "seen_at"
  | "source"
> & { order_items: { qty: number }[] | null };

export function toListItem(r: ListRow): OrderListItem {
  return {
    id: r.id,
    number: r.number,
    createdAt: r.created_at,
    customer: parseCustomerSnapshot(r.customer),
    status: r.status,
    paymentStatus: r.payment_status,
    paymentMethodCode: r.payment_method_code,
    fulfillment: r.fulfillment,
    total: Number(r.total),
    currency: r.currency,
    expiresAt: r.expires_at,
    seenAt: r.seen_at,
    itemsCount: (r.order_items ?? []).reduce((s, i) => s + i.qty, 0),
    source: r.source,
  };
}

/** Pedidos cuyo SKU de ítem coincide (para la búsqueda). */
async function orderIdsBySku(supabase: Supa, storeId: string, q: string): Promise<string[]> {
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("store_id", storeId)
    .ilike("sku", `%${q}%`)
    .limit(300);
  return Array.from(new Set((data ?? []).map((r) => r.order_id)));
}

export async function listOrders(
  supabase: Supa,
  storeId: string,
  f: OrderFilters,
  timezone: string,
): Promise<{ rows: OrderListItem[]; total: number }> {
  let query = supabase.from("orders").select(LIST_COLUMNS, { count: "exact" }).eq("store_id", storeId);

  const tabStatuses = TAB_STATUSES[f.tab];
  if (tabStatuses) query = query.in("status", tabStatuses);
  if (f.status) query = query.eq("status", f.status);
  if (f.payment === "impago") query = query.in("payment_status", ["pending", "partial"]);
  else if (f.payment) query = query.eq("payment_status", f.payment);
  if (f.method) query = query.eq("payment_method_code", f.method);
  if (f.fulfillment) query = query.eq("fulfillment", f.fulfillment);
  const from = ymdToZonedStart(f.from, timezone);
  if (from) query = query.gte("created_at", from.toISOString());
  const toStart = ymdToZonedStart(f.to, timezone);
  if (toStart) query = query.lt("created_at", addZonedDays(toStart, 1, timezone).toISOString());

  const q = sanitizeSearch(f.q);
  if (q) {
    const skuIds = await orderIdsBySku(supabase, storeId, q);
    const ors: string[] = [];
    const n = parseOrderNumber(q);
    if (n !== null) ors.push(`number.eq.${n}`);
    const like = `*${q}*`;
    ors.push(`customer->>name.ilike.${like}`, `customer->>email.ilike.${like}`, `customer->>phone.ilike.${like}`);
    if (skuIds.length) ors.push(`id.in.(${skuIds.join(",")})`);
    query = query.or(ors.join(","));
  }

  const sort = ORDER_SORTS[f.sort];
  query = query.order(sort.column, { ascending: sort.ascending }).order("number", { ascending: sort.ascending });

  const start = (f.page - 1) * ORDERS_PER_PAGE;
  const { data, count, error } = await query.range(start, start + ORDERS_PER_PAGE - 1);
  if (error) {
    console.error("[orders.list]", error.message);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []).map((r) => toListItem(r as ListRow)), total: count ?? 0 };
}

/** Conteos de las pestañas rápidas (globales, sin los demás filtros). */
export async function getOrderTabCounts(supabase: Supa, storeId: string): Promise<Record<OrderTab, number>> {
  const entries = await Promise.all(
    ORDER_TABS.map(async (tab) => {
      let q = supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId);
      const statuses = TAB_STATUSES[tab];
      if (statuses) q = q.in("status", statuses);
      const { count } = await q;
      return [tab, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<OrderTab, number>;
}

/**
 * Barrido perezoso de reservas vencidas de la tienda. Devuelve cuántos
 * pedidos canceló. Sin `storeId` usa la tienda activa del panel.
 */
export async function sweepExpiredOrders(supabase: Supa, storeId?: string): Promise<number> {
  const { data, error } = await supabase.rpc("expire_unpaid_orders", { p_store_id: await activeStoreId(storeId) });
  if (error) {
    console.error("[orders.expire]", error.message);
    return 0;
  }
  return data ?? 0;
}

// ---------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------

export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type OrderPaymentRow = Tables<"order_payments">;

export interface OrderEventView extends Tables<"order_events"> {
  authorName: string | null;
}

export interface OrderDetail {
  order: OrderRow;
  customer: CustomerSnapshot;
  customerRecord: Pick<Tables<"customers">, "id" | "name" | "email" | "phone" | "orders_count" | "total_spent"> | null;
  items: OrderItemRow[];
  events: OrderEventView[];
  payments: (OrderPaymentRow & { authorName: string | null })[];
  pickup: Pick<Tables<"pickup_locations">, "id" | "name" | "address" | "hours_text"> | null;
  /** ¿El pedido descontó stock al crearse (hay movimientos 'sale')? */
  stockDeducted: boolean;
}

async function profileNames(supabase: Supa, ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((i): i is string => Boolean(i))));
  if (!unique.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, name, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.name || p.email || "Equipo"]));
}

export async function getOrderDetail(supabase: Supa, storeId: string, id: string): Promise<OrderDetail | null> {
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (!order) return null;

  const [items, events, payments, pickup, customerRecord, sales] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).eq("store_id", storeId).order("created_at").order("id"),
    supabase
      .from("order_events")
      .select("*")
      .eq("order_id", id)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false }),
    supabase.from("order_payments").select("*").eq("order_id", id).eq("store_id", storeId).order("paid_at"),
    order.pickup_location_id
      ? supabase
          .from("pickup_locations")
          .select("id, name, address, hours_text")
          .eq("id", order.pickup_location_id)
          .eq("store_id", storeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    order.customer_id
      ? supabase
          .from("customers")
          .select("id, name, email, phone, orders_count, total_spent")
          .eq("id", order.customer_id)
          .eq("store_id", storeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("order_id", id)
      .eq("store_id", storeId)
      .eq("reason", "sale"),
  ]);

  const names = await profileNames(supabase, [
    ...(events.data ?? []).map((e) => e.created_by),
    ...(payments.data ?? []).map((p) => p.created_by),
  ]);

  return {
    order,
    customer: parseCustomerSnapshot(order.customer),
    customerRecord: customerRecord.data ?? null,
    items: items.data ?? [],
    events: (events.data ?? []).map((e) => ({ ...e, authorName: e.created_by ? (names.get(e.created_by) ?? "Equipo") : null })),
    payments: (payments.data ?? []).map((p) => ({ ...p, authorName: p.created_by ? (names.get(p.created_by) ?? "Equipo") : null })),
    pickup: pickup.data ?? null,
    stockDeducted: (sales.count ?? 0) > 0,
  };
}

/** Marca el pedido como visto por el admin (badge de nuevos). */
export async function markOrderSeen(
  supabase: Supa,
  storeId: string,
  order: Pick<OrderRow, "id" | "seen_at">,
): Promise<boolean> {
  if (order.seen_at) return false;
  const { error } = await supabase
    .from("orders")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("store_id", storeId);
  if (error) console.error("[orders.seen]", error.message);
  return !error;
}

// ---------------------------------------------------------------------
// Remitos
// ---------------------------------------------------------------------

export interface PrintableOrder {
  order: OrderRow;
  customer: CustomerSnapshot;
  items: OrderItemRow[];
  pickup: Pick<Tables<"pickup_locations">, "id" | "name" | "address" | "hours_text"> | null;
  paid: number;
}

export async function getOrdersForPrint(supabase: Supa, storeId: string, ids: string[]): Promise<PrintableOrder[]> {
  if (!ids.length) return [];
  const [{ data: orders }, { data: items }, { data: payments }] = await Promise.all([
    supabase.from("orders").select("*").eq("store_id", storeId).in("id", ids),
    supabase
      .from("order_items")
      .select("*")
      .eq("store_id", storeId)
      .in("order_id", ids)
      .order("created_at")
      .order("id"),
    supabase.from("order_payments").select("order_id, amount").eq("store_id", storeId).in("order_id", ids),
  ]);
  const pickupIds = Array.from(
    new Set((orders ?? []).map((o) => o.pickup_location_id).filter((v): v is string => Boolean(v))),
  );
  const { data: pickups } = pickupIds.length
    ? await supabase
        .from("pickup_locations")
        .select("id, name, address, hours_text")
        .eq("store_id", storeId)
        .in("id", pickupIds)
    : { data: [] as Pick<Tables<"pickup_locations">, "id" | "name" | "address" | "hours_text">[] };

  const byId = new Map((orders ?? []).map((o) => [o.id, o]));
  // Respeta el orden pedido en la URL.
  return ids
    .map((id) => byId.get(id))
    .filter((o): o is OrderRow => Boolean(o))
    .map((order) => ({
      order,
      customer: parseCustomerSnapshot(order.customer),
      items: (items ?? []).filter((i) => i.order_id === order.id),
      pickup: (pickups ?? []).find((p) => p.id === order.pickup_location_id) ?? null,
      paid: (payments ?? []).filter((p) => p.order_id === order.id).reduce((s, p) => s + Number(p.amount), 0),
    }));
}

// ---------------------------------------------------------------------
// Arrepentimientos
// ---------------------------------------------------------------------

export type WithdrawalStatus = "new" | "processed" | "rejected";

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  new: "Nueva",
  processed: "Procesada",
  rejected: "Rechazada",
};

export interface WithdrawalView extends Tables<"withdrawal_requests"> {
  order: Pick<OrderRow, "id" | "number" | "status" | "payment_status" | "total" | "created_at" | "fulfillment"> | null;
  processedByName: string | null;
}

export async function listWithdrawals(
  supabase: Supa,
  storeId: string,
  status: WithdrawalStatus | null,
): Promise<WithdrawalView[]> {
  let q = supabase
    .from("withdrawal_requests")
    .select("*, orders(id, number, status, payment_status, total, created_at, fulfillment)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    console.error("[withdrawals.list]", error.message);
    return [];
  }
  const names = await profileNames(supabase, (data ?? []).map((w) => w.processed_by));
  return (data ?? []).map(({ orders, ...w }) => ({
    ...w,
    order: orders ?? null,
    processedByName: w.processed_by ? (names.get(w.processed_by) ?? "Equipo") : null,
  }));
}

export async function countNewWithdrawals(supabase: Supa, storeId: string): Promise<number> {
  const { count } = await supabase
    .from("withdrawal_requests")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "new");
  return count ?? 0;
}
