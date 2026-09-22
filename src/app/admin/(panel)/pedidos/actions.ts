"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { ok, fail, runAction, zodFail, type ActionResult } from "@/lib/actions";
import { logAudit } from "@/lib/audit";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { applyStatusChange, deductOrderStock, insertOrderEvent, recordOrderPayment } from "@/lib/admin/order-ops";
import {
  amountPaid,
  balanceDue,
  computeManualTotals,
  extendedExpiry,
  orderStatusLabel,
  sanitizeSearch,
} from "@/lib/admin/order-utils";
import { getStoreInfo } from "@/lib/admin/orders";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  bulkStatusSchema,
  changeStatusSchema,
  extendSchema,
  idsSchema,
  internalNotesSchema,
  manualOrderSchema,
  noteSchema,
  paymentSchema,
  trackingSchema,
  withdrawalActionSchema,
  withdrawalNotesSchema,
} from "@/lib/schemas/order";
import type { Json, TablesInsert } from "@/lib/supabase/database.types";

/*
 * Server Actions de pedidos (spec §5): requireAdmin → zod → escribir →
 * logAudit → revalidateTag (sólo `products` cuando cambia el stock: los
 * pedidos no se cachean en el storefront) → ActionResult.
 */

const LIST_PATH = "/admin/pedidos";

function revalidateOrder(id?: string) {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(`${LIST_PATH}/${id}`);
  revalidatePath("/admin");
}

async function loadOrder(ctx: AdminContext, id: string) {
  const { data } = await ctx.supabase.from("orders").select("*").eq("id", id).maybeSingle();
  return data;
}

// ---------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------

export async function changeOrderStatus(input: unknown): Promise<ActionResult<{ stockDelta: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = changeStatusSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const order = await loadOrder(ctx, v.orderId);
    if (!order) return fail("El pedido no existe.");

    const res = await applyStatusChange(ctx, order, v.status, {
      reason: v.reason,
      ...(v.status === "shipped"
        ? { carrier: v.carrier, trackingNumber: v.trackingNumber, trackingUrl: v.trackingUrl }
        : {}),
    });
    if (!res.ok) return fail(res.error);

    await logAudit(ctx, {
      action: "order.status",
      entity: "order",
      entityId: order.id,
      summary: `#${order.number}: ${orderStatusLabel(res.data.from, order.fulfillment)} → ${orderStatusLabel(v.status, order.fulfillment)}`,
      diff: { status: [res.data.from, v.status], ...(v.reason ? { reason: v.reason } : {}) },
    });
    if (res.data.stockDelta) revalidateTag("products", "max");
    revalidateOrder(order.id);
    return ok({ stockDelta: res.data.stockDelta });
  });
}

export async function bulkChangeOrderStatus(
  input: unknown,
): Promise<ActionResult<{ updated: number; skipped: { number: number; error: string }[] }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = bulkStatusSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { ids, status, reason } = parsed.data;

    const { data: orders } = await ctx.supabase.from("orders").select("*").in("id", ids).order("number");
    let updated = 0;
    let stockChanged = false;
    const skipped: { number: number; error: string }[] = [];
    for (const order of orders ?? []) {
      if (order.status === status) continue;
      const res = await applyStatusChange(ctx, order, status, { reason });
      if (!res.ok) {
        skipped.push({ number: order.number, error: res.error });
        continue;
      }
      updated++;
      if (res.data.stockDelta) stockChanged = true;
    }

    if (updated) {
      await logAudit(ctx, {
        action: "order.bulk_status",
        entity: "order",
        summary: `Cambió ${updated} ${updated === 1 ? "pedido" : "pedidos"} a ${orderStatusLabel(status)}`,
        diff: { ids, status, ...(reason ? { reason } : {}) },
      });
    }
    if (stockChanged) revalidateTag("products", "max");
    revalidateOrder();
    return ok({ updated, skipped });
  });
}

export async function updateOrderTracking(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = trackingSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const order = await loadOrder(ctx, v.orderId);
    if (!order) return fail("El pedido no existe.");

    const { error } = await ctx.supabase
      .from("orders")
      .update({ tracking_carrier: v.carrier, tracking_number: v.trackingNumber, tracking_url: v.trackingUrl })
      .eq("id", order.id);
    if (error) return fail("No se pudo guardar el seguimiento.");

    const parts = ["Actualizamos el seguimiento del envío."];
    if (v.carrier) parts.push(`Transporte: ${v.carrier}.`);
    if (v.trackingNumber) parts.push(`Número: ${v.trackingNumber}.`);
    await insertOrderEvent(ctx, {
      orderId: order.id,
      type: "tracking_updated",
      message: parts.join(" "),
      visible: true,
      data: { carrier: v.carrier, tracking_number: v.trackingNumber, tracking_url: v.trackingUrl },
    });
    await logAudit(ctx, {
      action: "order.tracking",
      entity: "order",
      entityId: order.id,
      summary: `#${order.number}: seguimiento ${v.trackingNumber ?? "sin número"}`,
    });
    revalidateOrder(order.id);
    return ok();
  });
}

// ---------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------

export async function recordPayment(input: unknown): Promise<ActionResult<{ paymentStatus: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const order = await loadOrder(ctx, v.orderId);
    if (!order) return fail("El pedido no existe.");
    if (order.status === "cancelled") return fail("El pedido está cancelado: reabrilo para registrar pagos.");

    const store = await getStoreInfo(ctx.supabase);
    const amountLabel = formatMoney(v.amount, { currency: order.currency });
    const res = await recordOrderPayment(ctx, order, v, { inventoryPolicy: store.inventoryPolicy, amountLabel });
    if (!res.ok) return fail(res.error);

    await logAudit(ctx, {
      action: "order.payment",
      entity: "order",
      entityId: order.id,
      summary: `#${order.number}: pago de ${amountLabel}${v.reference ? ` (ref. ${v.reference})` : ""}`,
      diff: { amount: v.amount, method: v.methodCode, payment_status: [order.payment_status, res.data.paymentStatus] },
    });
    if (res.data.stockDelta) revalidateTag("products", "max");
    revalidateOrder(order.id);
    return ok({ paymentStatus: res.data.paymentStatus });
  });
}

/** Marca como pagados (registra un pago por el saldo) uno o varios pedidos. */
export async function markOrdersPaid(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = idsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);

    const [{ data: orders }, { data: payments }, store] = await Promise.all([
      ctx.supabase.from("orders").select("*").in("id", parsed.data.ids),
      ctx.supabase.from("order_payments").select("order_id, amount").in("order_id", parsed.data.ids),
      getStoreInfo(ctx.supabase),
    ]);

    let updated = 0;
    let stockChanged = false;
    for (const order of orders ?? []) {
      if (order.status === "cancelled") continue;
      const paid = amountPaid((payments ?? []).filter((p) => p.order_id === order.id));
      const due = balanceDue(Number(order.total), paid);
      if (due <= 0) continue;
      const amountLabel = formatMoney(due, { currency: order.currency });
      const res = await recordOrderPayment(
        ctx,
        order,
        { amount: due, methodCode: order.payment_method_code ?? "other", note: "Marcado como pagado" },
        { inventoryPolicy: store.inventoryPolicy, amountLabel },
      );
      if (!res.ok) continue;
      if (res.data.stockDelta) stockChanged = true;
      updated++;
    }

    if (updated) {
      await logAudit(ctx, {
        action: "order.mark_paid",
        entity: "order",
        entityId: parsed.data.ids.length === 1 ? parsed.data.ids[0] : null,
        summary: `Marcó ${updated} ${updated === 1 ? "pedido" : "pedidos"} como pagados`,
        diff: { ids: parsed.data.ids },
      });
    }
    if (stockChanged) revalidateTag("products", "max");
    revalidateOrder(parsed.data.ids.length === 1 ? parsed.data.ids[0] : undefined);
    return ok({ updated });
  });
}

export async function deletePayment(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const id = typeof input === "object" && input && "id" in input ? String((input as { id: unknown }).id) : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Pago inválido.");
    const { data: payment } = await ctx.supabase
      .from("order_payments")
      .select("id, order_id, amount, orders(number, currency)")
      .eq("id", id)
      .maybeSingle();
    if (!payment) return fail("El pago no existe.");

    const { error } = await ctx.supabase.from("order_payments").delete().eq("id", id);
    if (error) return fail("No se pudo eliminar el pago.");

    const label = formatMoney(Number(payment.amount), { currency: payment.orders?.currency ?? "ARS" });
    await insertOrderEvent(ctx, {
      orderId: payment.order_id,
      type: "payment_status_changed",
      message: `Se anuló un pago de ${label}.`,
      data: { amount: Number(payment.amount), payment_id: id },
    });
    await logAudit(ctx, {
      action: "order.payment_delete",
      entity: "order",
      entityId: payment.order_id,
      summary: `#${payment.orders?.number ?? "?"}: anuló un pago de ${label}`,
    });
    revalidateOrder(payment.order_id);
    return ok();
  });
}

// ---------------------------------------------------------------------
// Notas, reserva, WhatsApp, impresión
// ---------------------------------------------------------------------

export async function addOrderNote(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const order = await loadOrder(ctx, v.orderId);
    if (!order) return fail("El pedido no existe.");

    await insertOrderEvent(ctx, { orderId: order.id, type: "note", message: v.message, visible: v.visibleToCustomer });
    await logAudit(ctx, {
      action: "order.note",
      entity: "order",
      entityId: order.id,
      summary: `#${order.number}: nota ${v.visibleToCustomer ? "visible al cliente" : "interna"}`,
    });
    revalidateOrder(order.id);
    return ok();
  });
}

export async function saveInternalNotes(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = internalNotesSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { orderId, notes } = parsed.data;
    const { data, error } = await ctx.supabase
      .from("orders")
      .update({ internal_notes: notes.trim() || null })
      .eq("id", orderId)
      .select("number")
      .maybeSingle();
    if (error || !data) return fail("No se pudieron guardar las notas.");
    await logAudit(ctx, {
      action: "order.internal_notes",
      entity: "order",
      entityId: orderId,
      summary: `#${data.number}: editó las notas internas`,
    });
    return ok();
  });
}

/** Variante para `.bind(null, orderId)` desde el detalle (autoguardado). */
export async function saveInternalNotesFor(orderId: string, notes: string): Promise<ActionResult> {
  return saveInternalNotes({ orderId, notes });
}

export async function extendReservation(input: unknown): Promise<ActionResult<{ expiresAt: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = extendSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { orderId, hours } = parsed.data;
    const order = await loadOrder(ctx, orderId);
    if (!order) return fail("El pedido no existe.");
    if (order.status !== "pending" || order.payment_status !== "pending") {
      return fail("Sólo se extiende la reserva de pedidos pendientes sin pagar.");
    }

    const expiresAt = extendedExpiry(order.expires_at, hours).toISOString();
    const { error } = await ctx.supabase.from("orders").update({ expires_at: expiresAt }).eq("id", order.id);
    if (error) return fail("No se pudo extender la reserva.");

    const store = await getStoreInfo(ctx.supabase);
    await insertOrderEvent(ctx, {
      orderId: order.id,
      type: "reservation_extended",
      message: `Extendimos la reserva del stock hasta el ${formatDateTime(expiresAt, store.timezone)}.`,
      visible: true,
      data: { from: order.expires_at, to: expiresAt, hours },
    });
    await logAudit(ctx, {
      action: "order.extend",
      entity: "order",
      entityId: order.id,
      summary: `#${order.number}: extendió la reserva ${hours} h`,
    });
    revalidateOrder(order.id);
    return ok({ expiresAt });
  });
}

/** Registro (interno) de que se abrió WhatsApp con una plantilla. */
export async function logWhatsAppOpened(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const o = typeof input === "object" && input ? (input as { orderId?: unknown; template?: unknown }) : {};
    const orderId = String(o.orderId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return fail("Pedido inválido.");
    await insertOrderEvent(ctx, {
      orderId,
      type: "whatsapp_opened",
      message: "Se abrió WhatsApp para escribirle al cliente.",
      data: { template: typeof o.template === "string" ? o.template.slice(0, 40) : null },
    });
    revalidatePath(`${LIST_PATH}/${orderId}`);
    return ok();
  });
}

/** Evento `printed` por pedido al abrir la vista de remitos. */
export async function logOrdersPrinted(input: unknown): Promise<ActionResult<{ logged: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = idsSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const rows: TablesInsert<"order_events">[] = parsed.data.ids.map((id) => ({
      order_id: id,
      type: "printed",
      message: "Se imprimió el remito.",
      created_by: ctx.user.id,
      visible_to_customer: false,
    }));
    const { error } = await ctx.supabase.from("order_events").insert(rows);
    if (error) return fail("No se pudo registrar la impresión.");
    return ok({ logged: rows.length });
  });
}

/** Tras el barrido de reservas vencidas: refresca la caché de productos (stock). */
export async function revalidateAfterExpiry(): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    revalidateTag("products", "max");
    return ok();
  });
}

// ---------------------------------------------------------------------
// Pedido manual
// ---------------------------------------------------------------------

export interface CustomerHit {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  docNumber: string | null;
  defaultAddress: Json | null;
  ordersCount: number;
}

export async function searchCustomersForOrder(query: string): Promise<ActionResult<CustomerHit[]>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const q = sanitizeSearch(query);
    if (q.length < 2) return ok([]);
    const like = `*${q}*`;
    const { data } = await ctx.supabase
      .from("customers")
      .select("id, name, email, phone, doc_number, default_address, orders_count")
      .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like},doc_number.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(8);
    return ok(
      (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        docNumber: c.doc_number,
        defaultAddress: c.default_address,
        ordersCount: c.orders_count,
      })),
    );
  });
}

export interface VariantHit {
  variantId: string;
  productId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  price: number;
  stock: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  imageUrl: string | null;
  productStatus: string;
}

export async function searchVariantsForOrder(query: string): Promise<ActionResult<VariantHit[]>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const q = sanitizeSearch(query);
    if (q.length < 2) return ok([]);

    const [bySku, byName] = await Promise.all([
      ctx.supabase.from("product_variants").select("id").eq("is_active", true).ilike("sku", `%${q}%`).limit(20),
      ctx.supabase.from("products").select("id").neq("status", "archived").ilike("name", `%${q}%`).limit(20),
    ]);
    const variantIds = (bySku.data ?? []).map((v) => v.id);
    const productIds = (byName.data ?? []).map((p) => p.id);
    if (!variantIds.length && !productIds.length) return ok([]);

    const ors: string[] = [];
    if (variantIds.length) ors.push(`id.in.(${variantIds.join(",")})`);
    if (productIds.length) ors.push(`product_id.in.(${productIds.join(",")})`);
    const { data: variants } = await ctx.supabase
      .from("product_variants")
      .select(
        "id, product_id, title, sku, price, stock, track_inventory, allow_backorder, image_id, position, products(name, status)",
      )
      .eq("is_active", true)
      .or(ors.join(","))
      .order("position")
      .limit(30);

    const pids = Array.from(new Set((variants ?? []).map((v) => v.product_id)));
    const { data: images } = pids.length
      ? await ctx.supabase.from("product_images").select("id, product_id, url, position").in("product_id", pids).order("position")
      : { data: [] as { id: string; product_id: string; url: string; position: number }[] };

    const hits: VariantHit[] = (variants ?? [])
      .filter((v) => v.products && v.products.status !== "archived")
      .map((v) => ({
        variantId: v.id,
        productId: v.product_id,
        productName: v.products?.name ?? "Producto",
        variantTitle: v.title === "Default" ? null : v.title,
        sku: v.sku,
        price: Number(v.price),
        stock: v.stock,
        trackInventory: v.track_inventory,
        allowBackorder: v.allow_backorder,
        imageUrl:
          (images ?? []).find((i) => i.id === v.image_id)?.url ??
          (images ?? []).find((i) => i.product_id === v.product_id)?.url ??
          null,
        productStatus: v.products?.status ?? "active",
      }));
    return ok(hits.slice(0, 20));
  });
}

export async function createManualOrder(input: unknown): Promise<ActionResult<{ id: string; number: number }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = manualOrderSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;
    const store = await getStoreInfo(ctx.supabase);

    // ---------- Variantes y stock ----------
    const qtyByVariant = new Map<string, number>();
    for (const it of v.items) qtyByVariant.set(it.variantId, (qtyByVariant.get(it.variantId) ?? 0) + it.qty);
    const { data: variants } = await ctx.supabase
      .from("product_variants")
      .select("id, product_id, title, sku, price, stock, track_inventory, allow_backorder, image_id, products(name)")
      .in("id", [...qtyByVariant.keys()]);
    const byId = new Map((variants ?? []).map((x) => [x.id, x]));
    for (const [id, qty] of qtyByVariant) {
      const variant = byId.get(id);
      if (!variant) return fail("Uno de los productos ya no existe. Sacalo del pedido.");
      if (variant.track_inventory && !variant.allow_backorder && variant.stock < qty) {
        return fail(
          variant.stock <= 0
            ? `Sin stock de "${variant.products?.name ?? "producto"}".`
            : `Sin stock suficiente de "${variant.products?.name ?? "producto"}" (quedan ${variant.stock}).`,
        );
      }
    }
    const pids = Array.from(new Set((variants ?? []).map((x) => x.product_id)));
    const { data: images } = await ctx.supabase
      .from("product_images")
      .select("id, product_id, url, position")
      .in("product_id", pids)
      .order("position");

    // ---------- Método de pago ----------
    const { data: method } = await ctx.supabase
      .from("payment_methods")
      .select("code, discount_percent")
      .eq("code", v.paymentMethodCode)
      .maybeSingle();
    if (!method) return fail("El método de pago no existe.", { paymentMethodCode: ["Elegí un método válido"] });
    const pct = v.applyMethodDiscount ? Number(method.discount_percent) : 0;

    // ---------- Cliente ----------
    let customerId: string | null = null;
    let snapshot: { name: string; email: string | null; phone: string | null; doc: string | null };
    if (v.customer.mode === "existing") {
      const { data: c } = await ctx.supabase
        .from("customers")
        .select("id, name, email, phone, doc_number")
        .eq("id", v.customer.id)
        .maybeSingle();
      if (!c) return fail("El cliente elegido no existe.");
      customerId = c.id;
      snapshot = { name: c.name ?? c.email ?? "Cliente", email: c.email, phone: c.phone, doc: c.doc_number };
    } else {
      const nc = v.customer;
      snapshot = { name: nc.name, email: nc.email, phone: nc.phone, doc: nc.doc };
      const existing = nc.email
        ? (await ctx.supabase.from("customers").select("id").eq("email", nc.email).maybeSingle()).data
        : null;
      if (existing) {
        customerId = existing.id;
      } else {
        const { data: created, error } = await ctx.supabase
          .from("customers")
          .insert({
            name: nc.name,
            email: nc.email,
            phone: nc.phone,
            doc_number: nc.doc,
            default_address: v.fulfillment === "delivery" && v.shippingAddress ? v.shippingAddress : null,
          })
          .select("id")
          .single();
        if (error || !created) return fail("No se pudo crear el cliente.");
        customerId = created.id;
      }
    }

    // ---------- Envío ----------
    let zoneName: string | null = null;
    if (v.fulfillment === "delivery" && v.shippingZoneId) {
      const { data: zone } = await ctx.supabase.from("shipping_zones").select("name").eq("id", v.shippingZoneId).maybeSingle();
      zoneName = zone?.name ?? null;
    }
    if (v.fulfillment === "pickup" && v.pickupLocationId) {
      const { data: pl } = await ctx.supabase.from("pickup_locations").select("id").eq("id", v.pickupLocationId).maybeSingle();
      if (!pl) return fail("El punto de retiro no existe.");
    }

    // ---------- Totales ----------
    const lines = v.items.map((it) => {
      const variant = byId.get(it.variantId)!;
      const listPrice = Math.max(Number(variant.price), it.unitPrice);
      return { it, variant, listPrice };
    });
    const totals = computeManualTotals({
      lines: lines.map((l) => ({ listPrice: l.listPrice, unitPrice: l.it.unitPrice, qty: l.it.qty })),
      shippingCost: v.fulfillment === "delivery" ? v.shippingCost : 0,
      manualDiscount: v.manualDiscount,
      paymentDiscountPercent: pct,
    });

    // ---------- Pedido ----------
    const { data: order, error: orderError } = await ctx.supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        customer: snapshot,
        payment_method_code: method.code,
        payment_discount_percent: pct,
        payment_discount: totals.paymentDiscount,
        fulfillment: v.fulfillment,
        shipping_zone_id: v.fulfillment === "delivery" ? (v.shippingZoneId ?? null) : null,
        shipping_zone_name: zoneName,
        shipping_cost: totals.shippingCost,
        shipping_address: v.fulfillment === "delivery" && v.shippingAddress ? v.shippingAddress : null,
        pickup_location_id: v.fulfillment === "pickup" ? (v.pickupLocationId ?? null) : null,
        subtotal: totals.subtotal,
        promo_total: totals.promoTotal,
        coupon_discount: 0,
        discount_total: totals.discountTotal,
        total: totals.total,
        currency: store.currency,
        notes: v.notes,
        internal_notes: v.internalNotes,
        source: "manual",
        seen_at: new Date().toISOString(),
      })
      .select("id, number, status, expires_at")
      .single();
    if (orderError || !order) {
      console.error("[orders.manual]", orderError?.message);
      return fail("No se pudo crear el pedido.");
    }

    const { error: itemsError } = await ctx.supabase.from("order_items").insert(
      lines.map(({ it, variant, listPrice }) => ({
        order_id: order.id,
        product_id: variant.product_id,
        variant_id: variant.id,
        name: variant.products?.name ?? "Producto",
        variant_title: variant.title === "Default" ? null : variant.title,
        sku: variant.sku,
        image_url:
          (images ?? []).find((i) => i.id === variant.image_id)?.url ??
          (images ?? []).find((i) => i.product_id === variant.product_id)?.url ??
          null,
        unit_price: it.unitPrice,
        list_price: listPrice,
        qty: it.qty,
        total: Math.round(it.unitPrice * it.qty * 100) / 100,
      })),
    );
    if (itemsError) {
      // Compensación: sin ítems el pedido no sirve.
      await ctx.supabase.from("orders").delete().eq("id", order.id);
      console.error("[orders.manual.items]", itemsError.message);
      return fail("No se pudo crear el pedido.");
    }

    // La DB fija un vencimiento a los pedidos impagos; en los manuales es opcional.
    if (!v.reserve && order.expires_at) {
      await ctx.supabase.from("orders").update({ expires_at: null }).eq("id", order.id);
    }

    await insertOrderEvent(ctx, {
      orderId: order.id,
      type: "created",
      message: "Registramos tu pedido.",
      visible: true,
      data: { source: "manual", total: totals.total, items: v.items.length },
    });

    let stockDelta = 0;
    if (store.inventoryPolicy === "on_order" || v.markPaid) {
      stockDelta = await deductOrderStock(
        ctx,
        order,
        v.items.map((it) => ({ variantId: it.variantId, qty: it.qty })),
      );
    }

    if (v.markPaid && totals.total > 0) {
      await recordOrderPayment(
        ctx,
        { id: order.id, number: order.number, status: order.status },
        { amount: totals.total, methodCode: method.code, note: "Pagado al cargar el pedido" },
        // Ya descontamos arriba: evitamos el doble descuento de on_paid.
        { inventoryPolicy: "on_order", amountLabel: formatMoney(totals.total, { currency: store.currency }) },
      );
    }

    await logAudit(ctx, {
      action: "order.create_manual",
      entity: "order",
      entityId: order.id,
      summary: `Creó el pedido manual #${order.number} por ${formatMoney(totals.total, { currency: store.currency })}`,
    });
    if (stockDelta) revalidateTag("products", "max");
    revalidateOrder();
    return ok({ id: order.id, number: order.number });
  });
}

// ---------------------------------------------------------------------
// Arrepentimientos
// ---------------------------------------------------------------------

export async function resolveWithdrawal(input: unknown): Promise<ActionResult<{ cancelled: boolean }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = withdrawalActionSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const v = parsed.data;

    const { data: w } = await ctx.supabase.from("withdrawal_requests").select("*").eq("id", v.id).maybeSingle();
    if (!w) return fail("La solicitud no existe.");

    let cancelled = false;
    if (v.action === "process" && v.cancelOrder && w.order_id) {
      const order = await loadOrder(ctx, w.order_id);
      if (order && order.status !== "cancelled") {
        const res = await applyStatusChange(ctx, order, "cancelled", { reason: "arrepentimiento" });
        if (!res.ok) return fail(res.error);
        cancelled = true;
        if (res.data.stockDelta) revalidateTag("products", "max");
      }
    }

    const { error } = await ctx.supabase
      .from("withdrawal_requests")
      .update({
        status: v.action === "process" ? "processed" : "rejected",
        admin_notes: v.notes ?? w.admin_notes,
        processed_by: ctx.user.id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", w.id);
    if (error) return fail("No se pudo actualizar la solicitud.");

    if (w.order_id) {
      await insertOrderEvent(ctx, {
        orderId: w.order_id,
        type: "note",
        message:
          v.action === "process"
            ? `Procesamos tu solicitud de arrepentimiento ${w.code}.`
            : `Revisamos tu solicitud de arrepentimiento ${w.code} y no corresponde. Escribinos si tenés dudas.`,
        visible: true,
        data: { withdrawal_code: w.code, action: v.action },
      });
    }

    await logAudit(ctx, {
      action: v.action === "process" ? "withdrawal.process" : "withdrawal.reject",
      entity: "withdrawal_request",
      entityId: w.id,
      summary: `${v.action === "process" ? "Procesó" : "Rechazó"} el arrepentimiento ${w.code}${cancelled ? " y canceló el pedido" : ""}`,
    });
    revalidatePath(`${LIST_PATH}/arrepentimientos`);
    revalidateOrder(w.order_id ?? undefined);
    return ok({ cancelled });
  });
}

export async function saveWithdrawalNotes(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const parsed = withdrawalNotesSchema.safeParse(input);
    if (!parsed.success) return zodFail(parsed.error);
    const { error } = await ctx.supabase
      .from("withdrawal_requests")
      .update({ admin_notes: parsed.data.notes.trim() || null })
      .eq("id", parsed.data.id);
    if (error) return fail("No se pudieron guardar las notas.");
    revalidatePath(`${LIST_PATH}/arrepentimientos`);
    return ok();
  });
}
