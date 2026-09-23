import "server-only";

import type { AdminContext } from "@/lib/auth";
import { afterStockIncrease } from "@/lib/admin/inventory-alerts";
import {
  canTransition,
  customerStatusMessage,
  isOrderStatus,
  orderStatusLabel,
  stockToRededuct,
  stockToRestore,
  type OrderStatus,
} from "@/lib/admin/order-utils";
import type { Json, Tables, TablesUpdate } from "@/lib/supabase/database.types";

/**
 * Operaciones de escritura sobre pedidos compartidas por las actions
 * (individuales y masivas). Todo corre como el admin logueado (RLS) y
 * filtra por la tienda activa (`ctx.store.id`).
 * Los errores de negocio se devuelven como `{ ok: false, error }`.
 */

type Ctx = Pick<AdminContext, "supabase" | "user" | "store">;
type OrderRow = Tables<"orders">;

export type OpResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function insertOrderEvent(
  ctx: Ctx,
  e: { orderId: string; type: string; message: string; visible?: boolean; data?: Json },
): Promise<void> {
  const { error } = await ctx.supabase.from("order_events").insert({
    store_id: ctx.store.id,
    order_id: e.orderId,
    type: e.type,
    message: e.message,
    visible_to_customer: e.visible ?? false,
    data: e.data ?? {},
    created_by: ctx.user.id,
  });
  if (error) console.error("[order_events]", error.message);
}

async function orderMovements(ctx: Ctx, orderId: string) {
  const { data, error } = await ctx.supabase
    .from("inventory_movements")
    .select("variant_id, delta, reason")
    .eq("order_id", orderId)
    .eq("store_id", ctx.store.id);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Devuelve al stock lo que el pedido descontó (neto). Devuelve unidades. */
export async function restoreOrderStock(ctx: Ctx, order: Pick<OrderRow, "id" | "number">, note: string): Promise<number> {
  const moves = await orderMovements(ctx, order.id);
  const toRestore = stockToRestore(moves);
  let units = 0;
  const restored: string[] = [];
  for (const [variantId, qty] of toRestore) {
    const { error } = await ctx.supabase.rpc("adjust_stock", {
      p_variant_id: variantId,
      p_delta: qty,
      p_reason: "cancel",
      p_note: note,
      p_order_id: order.id,
    });
    if (error) throw new Error(error.message);
    units += qty;
    if (qty > 0) restored.push(variantId);
  }
  // "Avisame cuando haya stock": lo devuelto puede reponer una variante agotada.
  afterStockIncrease(ctx, restored);
  return units;
}

/**
 * Descuenta stock de los ítems del pedido (alta manual o política
 * `on_paid`). Sólo variantes con `track_inventory`. Devuelve unidades.
 */
export async function deductOrderStock(
  ctx: Ctx,
  order: Pick<OrderRow, "id" | "number">,
  lines: { variantId: string; qty: number }[],
): Promise<number> {
  const ids = Array.from(new Set(lines.map((l) => l.variantId)));
  if (!ids.length) return 0;
  const { data: variants } = await ctx.supabase
    .from("product_variants")
    .select("id, track_inventory")
    .eq("store_id", ctx.store.id)
    .in("id", ids);
  const tracked = new Set((variants ?? []).filter((v) => v.track_inventory).map((v) => v.id));
  let units = 0;
  for (const l of lines) {
    if (!tracked.has(l.variantId) || l.qty <= 0) continue;
    const { error } = await ctx.supabase.rpc("adjust_stock", {
      p_variant_id: l.variantId,
      p_delta: -l.qty,
      p_reason: "sale",
      p_note: `Pedido #${order.number}`,
      p_order_id: order.id,
    });
    if (error) throw new Error(error.message);
    units += l.qty;
  }
  return units;
}

/** ¿El pedido tiene algún movimiento de venta? */
export async function hasSaleMovements(ctx: Ctx, orderId: string): Promise<boolean> {
  const { count } = await ctx.supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("store_id", ctx.store.id)
    .eq("reason", "sale");
  return (count ?? 0) > 0;
}

export interface StatusChangeOptions {
  reason?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

export interface StatusChangeResult {
  from: OrderStatus;
  to: OrderStatus;
  /** Unidades devueltas (+) o descontadas (−) de stock. */
  stockDelta: number;
}

/**
 * Cambia el estado de un pedido con sus efectos:
 * fechas (shipped_at, delivered_at, cancelled_at), seguimiento, evento
 * visible para el cliente, y stock (devolver al cancelar sólo si se
 * descontó; volver a descontar al reabrir).
 */
export async function applyStatusChange(
  ctx: Ctx,
  order: OrderRow,
  to: OrderStatus,
  opts: StatusChangeOptions = {},
): Promise<OpResult<StatusChangeResult>> {
  if (!isOrderStatus(order.status)) return { ok: false, error: "El pedido tiene un estado desconocido." };
  const from = order.status;
  if (!canTransition(from, to)) {
    return {
      ok: false,
      error:
        from === "cancelled"
          ? `El pedido #${order.number} está cancelado: reabrilo primero.`
          : `El pedido #${order.number} ya está ${orderStatusLabel(to, order.fulfillment).toLowerCase()}.`,
    };
  }

  const now = new Date().toISOString();
  const patch: TablesUpdate<"orders"> = { status: to };
  if (to === "shipped") {
    patch.shipped_at = order.shipped_at ?? now;
    if (opts.carrier !== undefined) patch.tracking_carrier = opts.carrier;
    if (opts.trackingNumber !== undefined) patch.tracking_number = opts.trackingNumber;
    if (opts.trackingUrl !== undefined) patch.tracking_url = opts.trackingUrl;
  }
  if (to === "delivered") patch.delivered_at = order.delivered_at ?? now;
  if (to === "cancelled") {
    patch.cancelled_at = now;
    patch.cancel_reason = opts.reason ?? null;
    patch.expires_at = null;
  }
  if (from === "cancelled" && to === "pending") {
    patch.cancelled_at = null;
    patch.cancel_reason = null;
  }

  // Reabrir: primero verificar que alcance el stock que se vuelve a descontar.
  let rededuct = new Map<string, number>();
  if (from === "cancelled") {
    const [{ data: items }, moves] = await Promise.all([
      ctx.supabase.from("order_items").select("variant_id, qty, name").eq("order_id", order.id).eq("store_id", ctx.store.id),
      orderMovements(ctx, order.id),
    ]);
    rededuct = stockToRededuct(items ?? [], moves);
    if (rededuct.size) {
      const { data: variants } = await ctx.supabase
        .from("product_variants")
        .select("id, stock, track_inventory, allow_backorder, products(name)")
        .eq("store_id", ctx.store.id)
        .in("id", [...rededuct.keys()]);
      for (const v of variants ?? []) {
        const need = rededuct.get(v.id) ?? 0;
        if (v.track_inventory && !v.allow_backorder && v.stock < need) {
          return {
            ok: false,
            error: `No alcanza el stock de "${v.products?.name ?? "un producto"}" para reabrir (hay ${v.stock}, hacen falta ${need}).`,
          };
        }
      }
    }
  }

  const { error } = await ctx.supabase
    .from("orders")
    .update(patch)
    .eq("id", order.id)
    .eq("store_id", ctx.store.id)
    .eq("status", from);
  if (error) return { ok: false, error: "No se pudo actualizar el pedido." };

  const tracking = {
    carrier: patch.tracking_carrier ?? order.tracking_carrier,
    number: patch.tracking_number ?? order.tracking_number,
    url: patch.tracking_url ?? order.tracking_url,
  };
  const message = customerStatusMessage(to, order.fulfillment, tracking);
  const type = to === "cancelled" ? "cancelled" : to === "shipped" ? "shipped" : "status_changed";
  await insertOrderEvent(ctx, {
    orderId: order.id,
    type,
    message,
    visible: true,
    data: {
      from,
      to,
      ...(opts.reason ? { reason: opts.reason } : {}),
      ...(to === "shipped" ? { carrier: tracking.carrier, tracking_number: tracking.number, tracking_url: tracking.url } : {}),
    },
  });

  let stockDelta = 0;
  if (to === "cancelled") {
    stockDelta = await restoreOrderStock(ctx, order, `Pedido #${order.number} cancelado`);
    if (stockDelta) {
      await insertOrderEvent(ctx, {
        orderId: order.id,
        type: "stock_adjusted",
        message: `Se devolvieron ${stockDelta} ${stockDelta === 1 ? "unidad" : "unidades"} al stock.`,
        data: { units: stockDelta },
      });
    }
  } else if (from === "cancelled" && rededuct.size) {
    for (const [variantId, qty] of rededuct) {
      const { error: e } = await ctx.supabase.rpc("adjust_stock", {
        p_variant_id: variantId,
        p_delta: -qty,
        p_reason: "sale",
        p_note: `Pedido #${order.number} reabierto`,
        p_order_id: order.id,
      });
      if (e) throw new Error(e.message);
      stockDelta -= qty;
    }
    await insertOrderEvent(ctx, {
      orderId: order.id,
      type: "stock_adjusted",
      message: `Se volvieron a descontar ${-stockDelta} ${stockDelta === -1 ? "unidad" : "unidades"} del stock.`,
      data: { units: stockDelta },
    });
  }

  return { ok: true, data: { from, to, stockDelta } };
}

/**
 * Registra un pago. El trigger de la DB recalcula `payment_status`. Si la
 * tienda descuenta stock al pagar (`on_paid`) y el pedido quedó pagado sin
 * haber descontado, descuenta ahora.
 */
export async function recordOrderPayment(
  ctx: Ctx,
  order: Pick<OrderRow, "id" | "number" | "status">,
  p: {
    amount: number;
    methodCode: string;
    reference?: string | null;
    receiptUrl?: string | null;
    paidAt?: string | null;
    note?: string | null;
  },
  opts: { inventoryPolicy: "on_order" | "on_paid"; amountLabel: string },
): Promise<OpResult<{ paymentStatus: string; stockDelta: number }>> {
  const { error } = await ctx.supabase.from("order_payments").insert({
    store_id: ctx.store.id,
    order_id: order.id,
    amount: p.amount,
    method_code: p.methodCode,
    reference: p.reference ?? null,
    receipt_url: p.receiptUrl ?? null,
    paid_at: p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString(),
    note: p.note ?? null,
    created_by: ctx.user.id,
  });
  if (error) return { ok: false, error: "No se pudo registrar el pago." };

  const { data: fresh } = await ctx.supabase
    .from("orders")
    .select("payment_status, expires_at")
    .eq("id", order.id)
    .eq("store_id", ctx.store.id)
    .single();
  const paymentStatus = fresh?.payment_status ?? "pending";

  // Con un pago registrado la reserva deja de vencer.
  if (fresh?.expires_at) {
    await ctx.supabase.from("orders").update({ expires_at: null }).eq("id", order.id).eq("store_id", ctx.store.id);
  }

  await insertOrderEvent(ctx, {
    orderId: order.id,
    type: "payment_added",
    message:
      paymentStatus === "paid"
        ? `Registramos tu pago de ${opts.amountLabel}. El pedido está pago.`
        : `Registramos un pago de ${opts.amountLabel}.`,
    visible: true,
    data: { amount: p.amount, method: p.methodCode, reference: p.reference ?? null, payment_status: paymentStatus },
  });

  let stockDelta = 0;
  if (opts.inventoryPolicy === "on_paid" && paymentStatus === "paid" && order.status !== "cancelled") {
    if (!(await hasSaleMovements(ctx, order.id))) {
      const { data: items } = await ctx.supabase
        .from("order_items")
        .select("variant_id, qty")
        .eq("order_id", order.id)
        .eq("store_id", ctx.store.id);
      stockDelta = -(await deductOrderStock(
        ctx,
        order,
        (items ?? []).filter((i) => i.variant_id).map((i) => ({ variantId: i.variant_id as string, qty: i.qty })),
      ));
    }
  }
  return { ok: true, data: { paymentStatus, stockDelta } };
}
