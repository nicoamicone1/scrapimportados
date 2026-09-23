import "server-only";

import { after } from "next/server";

import type { ServerSupabase } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/server";
import { deliveryText, getOrderByToken, type PublicOrder } from "@/lib/store/orders";
import type { StoreSettings } from "@/lib/store/settings";
import { buildOrderMessage, buildReceiptMessage, waLink } from "@/lib/store/whatsapp";
import { platformOrigin, storeUrl, type StoreUrlTarget } from "@/lib/tenant/urls";
import { parseTheme } from "@/lib/theme";

import { emailEnabled, isEmail, platformFrom, sendEmail, storeFrom, warnEmailDisabled, type EmailTag } from "./send";
import {
  newOrderSellerEmail,
  orderCancelledEmail,
  orderPaidEmail,
  orderReceivedEmail,
  orderShippedEmail,
  planRequestEmail,
  welcomeEmail,
  withdrawalSellerEmail,
  type OrderEmailData,
  type StoreEmailInfo,
} from "./templates";
import { plainInstructions } from "./templates/shared";

/*
 * Disparadores de emails transaccionales. Cada función:
 * - se llama DESPUÉS de que la operación de negocio salió bien;
 * - agenda el trabajo con `after()` (Next lo corre cuando ya se respondió;
 *   en Vercel extiende la función con `waitUntil`), así un mail lento nunca
 *   demora un checkout ni un cambio de estado;
 * - nunca lanza: cualquier error queda en el log con el prefijo `[email]`;
 * - sin `RESEND_API_KEY` no hace nada (ni siquiera lee datos).
 *
 * Los datos del pedido salen de `get_order_by_token` (security definer,
 * filtrado por `store_id` en `getOrderByToken`): funciona igual desde el
 * storefront (anon) que desde el admin y nunca expone `internal_notes`.
 */

type StoreTarget = StoreUrlTarget & { id: string };

/** Agenda `task` para después de responder. Fuera de un request (tests, scripts) corre en segundo plano. */
function schedule(label: string, task: () => Promise<unknown>): void {
  if (!emailEnabled()) {
    warnEmailDisabled();
    return;
  }
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[email] ${label}:`, err instanceof Error ? err.message : err);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

function tags(kind: string, store?: { slug: string }): EmailTag[] {
  return store ? [{ name: "kind", value: kind }, { name: "store", value: store.slug }] : [{ name: "kind", value: kind }];
}

function platformSupportEmail(): string | null {
  const v = process.env.PLATFORM_EMAIL?.trim();
  return isEmail(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

interface BrandSettings {
  logoUrl: string | null;
  primary: string | null;
  primaryText: string | null;
}

function brandFromSettings(settings: Pick<StoreSettings, "logo_url" | "theme">): BrandSettings {
  return { logoUrl: settings.logo_url, primary: settings.theme.colors.primary, primaryText: settings.theme.colors.primaryText };
}

/** Logo y color del tema (lectura pública; si falla, el mail sale con tinta neutra). */
async function loadBrand(storeId: string): Promise<BrandSettings> {
  try {
    const { data } = await createPublicClient().from("store_settings").select("logo_url, theme").eq("store_id", storeId).maybeSingle();
    if (!data) return { logoUrl: null, primary: null, primaryText: null };
    const theme = parseTheme(data.theme);
    return { logoUrl: data.logo_url, primary: theme.colors.primary, primaryText: theme.colors.primaryText };
  } catch {
    return { logoUrl: null, primary: null, primaryText: null };
  }
}

function toEmailOrder(o: PublicOrder, statusUrl: string): OrderEmailData {
  const pm = o.paymentMethod;
  const isTransfer = pm?.type === "transfer" || o.paymentMethodCode === "transfer";
  return {
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    currency: o.currency,
    locale: o.store.locale,
    timezone: o.store.timezone,
    status: o.status,
    paymentStatus: o.paymentStatus,
    customer: { name: o.customer.name, email: o.customer.email, phone: o.customer.phone },
    items: o.items.map((i) => ({ name: i.name, variantTitle: i.variantTitle, qty: i.qty, unitPrice: i.unitPrice, total: i.total })),
    subtotal: o.subtotal,
    promoTotal: o.promoTotal,
    couponCode: o.couponCode,
    couponDiscount: o.couponDiscount,
    paymentDiscount: o.paymentDiscount,
    paymentDiscountPercent: o.paymentDiscountPercent,
    shippingCost: o.shippingCost,
    shippingZoneName: o.shippingZoneName,
    total: o.total,
    fulfillment: o.fulfillment,
    deliveryText: deliveryText(o),
    pickup: o.pickupLocation ? { name: o.pickupLocation.name, address: o.pickupLocation.address, hoursText: o.pickupLocation.hoursText } : null,
    payment: pm ? { name: pm.name, type: isTransfer ? "transfer" : pm.type, instructions: plainInstructions(pm.instructionsMd) } : null,
    transfer: isTransfer
      ? {
          bankName: o.transfer.bankName,
          holder: o.transfer.holder,
          cbu: o.transfer.cbu,
          alias: o.transfer.alias,
          cuit: o.transfer.cuit,
          instructions: plainInstructions(o.transfer.instructionsMd),
        }
      : null,
    expiresAt: o.expiresAt,
    notes: o.notes,
    tracking: o.tracking,
    cancelReason: o.cancelReason,
    statusUrl,
  };
}

/** WhatsApp de la tienda con un mensaje acorde al mail (comprobante, pedido armado o consulta). */
function buyerWhatsappUrl(o: PublicOrder, statusUrl: string, purpose: "received" | "other"): string | null {
  const phone = o.store.whatsappPhone;
  if (!phone) return null;
  if (purpose === "received" && o.paymentStatus !== "paid") {
    if (o.paymentMethod?.type === "transfer") {
      return waLink(
        phone,
        `${buildReceiptMessage({ number: o.number, total: o.total, customerName: o.customer.name, storeName: o.store.name, currency: o.currency })} ${statusUrl}`,
      );
    }
    if (o.paymentMethod?.type === "whatsapp") {
      return waLink(
        phone,
        buildOrderMessage({
          template: o.whatsappTemplate,
          number: o.number,
          storeName: o.store.name,
          customerName: o.customer.name,
          items: o.items.map((i) => ({ name: i.name, variantTitle: i.variantTitle, qty: i.qty, total: i.total })),
          total: o.total,
          delivery: deliveryText(o),
          payment: o.paymentMethod.name,
          url: statusUrl,
          currency: o.currency,
        }),
      );
    }
  }
  return waLink(phone, `Hola. Consulto por el pedido #${o.number}. ${statusUrl}`);
}

function buyerStoreInfo(o: PublicOrder, target: StoreTarget, brand: BrandSettings, whatsappUrl: string | null): StoreEmailInfo {
  const contact = o.store.contactEmail.trim();
  return {
    name: o.store.name,
    url: storeUrl(target),
    logoUrl: brand.logoUrl,
    primary: brand.primary,
    primaryText: brand.primaryText,
    contactEmail: isEmail(contact) ? contact : null,
    whatsappUrl,
  };
}

// ---------------------------------------------------------------------------
// Pedido nuevo (storefront): "Recibimos tu pedido" + "Nuevo pedido"
// ---------------------------------------------------------------------------

export function notifyOrderCreated(input: { store: StoreTarget; settings: StoreSettings; token: string }): void {
  const { store, settings, token } = input;
  schedule("pedido nuevo", async () => {
    const order = await getOrderByToken(store.id, token);
    if (!order) return;
    const statusUrl = storeUrl(store, `/pedido/${order.token}`);
    const data = toEmailOrder(order, statusUrl);
    const info = buyerStoreInfo(order, store, brandFromSettings(settings), buyerWhatsappUrl(order, statusUrl, "received"));
    const sellerTo = info.contactEmail;

    await Promise.all([
      isEmail(order.customer.email)
        ? sendEmail({
            to: order.customer.email,
            from: storeFrom(info.name),
            replyTo: info.contactEmail,
            ...orderReceivedEmail(data, info),
            tags: tags("order_received", store),
            idempotencyKey: `order-received/${order.id}`,
          })
        : null,
      isEmail(sellerTo)
        ? sendEmail({
            to: sellerTo,
            from: platformFrom(),
            replyTo: isEmail(order.customer.email) ? order.customer.email : null,
            ...newOrderSellerEmail(data, { name: info.name, contactEmail: sellerTo, platformUrl: platformOrigin() }),
            tags: tags("order_new_seller", store),
            idempotencyKey: `order-new-seller/${order.id}`,
          })
        : null,
    ]);
  });
}

// ---------------------------------------------------------------------------
// Cambios del admin: pago confirmado, enviado, seguimiento, cancelado
// ---------------------------------------------------------------------------

export type OrderEmailEvent = "paid" | "shipped" | "tracking" | "cancelled";

/**
 * Mail al comprador por un cambio hecho desde el panel. El caller decide la
 * idempotencia (sólo llama en la transición); acá se re-chequea el estado
 * actual para no mandar un "enviado" de un pedido que ya se volvió atrás.
 */
export function notifyOrderEvent(store: StoreTarget, order: { id: string; public_token: string }, event: OrderEmailEvent): void {
  schedule(`pedido ${event}`, async () => {
    const [o, brand] = await Promise.all([getOrderByToken(store.id, order.public_token), loadBrand(store.id)]);
    if (!o || o.id !== order.id || !isEmail(o.customer.email)) return;
    if (event === "paid" && o.paymentStatus !== "paid") return;
    if ((event === "shipped" || event === "tracking") && o.status !== "shipped") return;
    if (event === "tracking" && !o.tracking?.number) return;
    if (event === "cancelled" && o.status !== "cancelled") return;

    const statusUrl = storeUrl(store, `/pedido/${o.token}`);
    const data = toEmailOrder(o, statusUrl);
    const info = buyerStoreInfo(o, store, brand, buyerWhatsappUrl(o, statusUrl, "other"));
    const content =
      event === "paid"
        ? orderPaidEmail(data, info)
        : event === "cancelled"
          ? orderCancelledEmail(data, info)
          : orderShippedEmail(data, info, { trackingUpdate: event === "tracking" });
    const key =
      event === "tracking"
        ? `order-tracking/${o.id}/${o.tracking?.number ?? ""}`
        : event === "cancelled"
          ? `order-cancelled/${o.id}/${o.events.filter((e) => e.type === "cancelled").length}`
          : `order-${event}/${o.id}`;

    await sendEmail({
      to: o.customer.email,
      from: storeFrom(info.name),
      replyTo: info.contactEmail,
      ...content,
      tags: tags(`order_${event}`, store),
      idempotencyKey: key,
    });
  });
}

/**
 * Cambio de estado desde el panel → mail si corresponde:
 * - "enviado"/"listo para retirar" sólo la PRIMERA vez que pasa a `shipped`
 *   (`shipped_at` vacío antes del cambio: volver atrás y re-enviar no repite);
 * - "cancelado" en cada cancelación (reabrir y volver a cancelar es otro evento).
 */
export function notifyStatusChange(
  store: StoreTarget,
  order: { id: string; public_token: string; shipped_at: string | null },
  to: string,
): void {
  if (to === "shipped" && !order.shipped_at) notifyOrderEvent(store, order, "shipped");
  else if (to === "cancelled") notifyOrderEvent(store, order, "cancelled");
}

/** "Pago confirmado" sólo cuando `payment_status` PASA a `paid` (no en pagos parciales). */
export function notifyPaymentChange(
  store: StoreTarget,
  order: { id: string; public_token: string; payment_status: string },
  next: string,
): void {
  if (order.payment_status !== "paid" && next === "paid") notifyOrderEvent(store, order, "paid");
}

// ---------------------------------------------------------------------------
// Arrepentimiento (storefront) → aviso al vendedor
// ---------------------------------------------------------------------------

export function notifyWithdrawal(input: {
  store: StoreTarget & { name: string };
  code: string;
  name: string;
  contact: string;
  orderNumber: string | null;
  orderFound: boolean;
  reason: string | null;
}): void {
  const { store } = input;
  schedule("arrepentimiento", async () => {
    const { data } = await createPublicClient()
      .from("store_settings")
      .select("name, contact_email, timezone")
      .eq("store_id", store.id)
      .maybeSingle();
    const to = data?.contact_email?.trim();
    if (!isEmail(to)) return;
    const content = withdrawalSellerEmail(
      {
        code: input.code,
        name: input.name,
        contact: input.contact,
        orderNumber: input.orderNumber,
        orderFound: input.orderFound,
        reason: input.reason,
        createdAt: new Date().toISOString(),
        timezone: data?.timezone || "America/Argentina/Buenos_Aires",
      },
      { name: data?.name || store.name, contactEmail: to, platformUrl: platformOrigin() },
    );
    await sendEmail({
      to,
      from: platformFrom(),
      replyTo: isEmail(input.contact) ? input.contact : null,
      ...content,
      tags: tags("withdrawal_seller", store),
      idempotencyKey: `withdrawal/${store.id}/${input.code}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Cuenta: bienvenida al crear la tienda
// ---------------------------------------------------------------------------

export function notifyStoreCreated(input: {
  supabase: ServerSupabase;
  storeId: string;
  slug: string;
  name: string;
  ownerId: string;
  ownerEmail: string | null | undefined;
}): void {
  const { supabase, storeId, slug, name, ownerId, ownerEmail } = input;
  if (!isEmail(ownerEmail)) return;
  schedule("bienvenida", async () => {
    const [{ data: sub }, { data: profile }] = await Promise.all([
      supabase.from("subscriptions").select("status, trial_ends_at").eq("store_id", storeId).maybeSingle(),
      supabase.from("profiles").select("name").eq("id", ownerId).maybeSingle(),
    ]);
    const support = platformSupportEmail();
    await sendEmail({
      to: ownerEmail,
      from: platformFrom(),
      replyTo: support,
      ...welcomeEmail({
        storeName: name,
        storeUrl: storeUrl({ slug }),
        platformUrl: platformOrigin(),
        ownerName: profile?.name ?? null,
        supportEmail: support,
        trialEndsAt: sub?.status === "trialing" ? sub.trial_ends_at : null,
      }),
      tags: tags("welcome", { slug }),
      idempotencyKey: `welcome/${storeId}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Plataforma: pedido de cambio de plan
// ---------------------------------------------------------------------------

export function notifyPlanRequest(input: {
  store: StoreTarget & { name: string; slug: string };
  currentPlan: string;
  currentTrial: boolean;
  requestedPlan: string;
  requestedBy: string | null | undefined;
}): void {
  const to = platformSupportEmail();
  if (!to) return;
  const { store } = input;
  const requestedAt = new Date().toISOString();
  schedule("pedido de plan", async () => {
    await sendEmail({
      to,
      from: platformFrom(),
      replyTo: isEmail(input.requestedBy) ? input.requestedBy : null,
      ...planRequestEmail({
        storeId: store.id,
        storeName: store.name,
        storeUrl: storeUrl(store),
        currentPlan: input.currentPlan,
        currentTrial: input.currentTrial,
        requestedPlan: input.requestedPlan,
        requestedBy: input.requestedBy ?? null,
        requestedAt,
        platformUrl: platformOrigin(),
      }),
      tags: tags("plan_request", store),
    });
  });
}
