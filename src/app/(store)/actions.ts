"use server";

import { z } from "zod";

import { fail, GENERIC_ERROR, ok, zodFail, type ActionResult } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { computeCart, type Coupon, type CartTotals } from "@/lib/pricing";
import { normalizeProvince, provinceName, quoteShipping } from "@/lib/shipping";
import { describeIssue, validateCart, type CartPatch } from "@/lib/store/cart-validation";
import { deliveryText, getOrderByToken } from "@/lib/store/orders";
import { fetchPaymentMethodsFresh } from "@/lib/store/payment-methods";
import { getFreshVariants } from "@/lib/store/products";
import { fetchActivePromotionsFresh } from "@/lib/store/promotions";
import { absoluteUrl } from "@/lib/store/seo";
import { fetchSettingsFresh } from "@/lib/store/settings";
import { fetchPickupLocationsFresh, fetchShippingZonesFresh } from "@/lib/store/shipping";
import { buildOrderMessage, waLink } from "@/lib/store/whatsapp";
import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";

/*
 * Acciones PÚBLICAS del storefront (sin requireAdmin: las usa cualquier
 * visitante). La única escritura es `create_order` / `create_withdrawal_request`
 * (RPC security definer). Todo se valida con zod y se recalcula en el server.
 */

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Validar el carrito contra la DB
// ---------------------------------------------------------------------------

const cartLineSchema = z.object({
  variantId: uuid,
  name: z.string().max(300),
  variantTitle: z.string().max(200).nullish(),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().min(1).max(999),
});

export interface CartCheck {
  patches: CartPatch[];
  messages: string[];
}

export async function checkCart(input: unknown): Promise<ActionResult<CartCheck>> {
  const parsed = z.array(cartLineSchema).max(100).safeParse(input);
  if (!parsed.success) return zodFail(parsed.error, "El carrito tiene datos inválidos.");
  try {
    const fresh = await getFreshVariants(parsed.data.map((i) => i.variantId));
    const { patches, issues } = validateCart(parsed.data, fresh);
    return ok({ patches, messages: issues.map(describeIssue) });
  } catch (err) {
    console.error(err);
    return fail(GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Cupón
// ---------------------------------------------------------------------------

const couponSchema = z.object({
  code: z.string().trim().min(2, "Ingresá el código").max(40),
  email: z.string().email().nullish(),
  items: z.array(z.object({ variantId: uuid, qty: z.number().int().min(1).max(999) })).min(1).max(100),
});

interface CouponRpc {
  valid?: boolean;
  reason?: string;
  code?: string;
  type?: string;
  value?: number;
  scope?: string;
  category_ids?: string[] | null;
  product_ids?: string[] | null;
  min_subtotal?: number | null;
}

async function validateCouponServer(
  code: string,
  lines: { productId: string; variantId: string; qty: number; unitPrice: number }[],
  subtotal: number,
  email?: string | null,
): Promise<{ coupon: Coupon } | { reason: string }> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: code,
    p_subtotal: subtotal,
    p_items: lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, qty: l.qty, unit_price: l.unitPrice })) as unknown as Json,
    p_email: email ?? undefined,
  });
  if (error) {
    console.error(error);
    return { reason: "No pudimos validar el cupón. Probá de nuevo." };
  }
  const r = (data ?? {}) as CouponRpc;
  if (!r.valid) return { reason: r.reason || "El cupón no es válido" };
  return {
    coupon: {
      code: r.code ?? code.toUpperCase(),
      type: r.type === "fixed" ? "fixed" : r.type === "free_shipping" ? "free_shipping" : "percent",
      value: Number(r.value ?? 0),
      minSubtotal: r.min_subtotal == null ? null : Number(r.min_subtotal),
      scope: r.scope === "categories" ? "categories" : r.scope === "products" ? "products" : "all",
      categoryIds: r.category_ids ?? [],
      productIds: r.product_ids ?? [],
      isActive: true,
    },
  };
}

export async function applyCoupon(input: unknown): Promise<ActionResult<{ coupon: Coupon; message: string }>> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error, "Ingresá un código de cupón.");
  try {
    const [fresh, promotions] = await Promise.all([getFreshVariants(parsed.data.items.map((i) => i.variantId)), fetchActivePromotionsFresh()]);
    const items = parsed.data.items
      .map((i) => ({ i, v: fresh.get(i.variantId) }))
      .filter((x) => x.v && x.v.active)
      .map(({ i, v }) => ({ variantId: i.variantId, productId: v!.productId, categoryIds: v!.categoryIds, qty: i.qty, listPrice: v!.price }));
    if (!items.length) return fail("Tu carrito está vacío.");
    const base = computeCart({ items, promotions });
    const lines = base.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice }));
    const result = await validateCouponServer(parsed.data.code, lines, base.merchandiseTotal, parsed.data.email);
    if ("reason" in result) return fail(result.reason);
    const withCoupon = computeCart({ items, promotions, coupon: result.coupon });
    if (withCoupon.coupon && !withCoupon.coupon.applied) return fail(withCoupon.coupon.reason);
    const message =
      result.coupon.type === "free_shipping"
        ? "Cupón aplicado: envío gratis."
        : `Cupón aplicado: ${formatMoney(withCoupon.couponDiscount)} de descuento.`;
    return ok({ coupon: result.coupon, message });
  } catch (err) {
    console.error(err);
    return fail(GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Cotizar envío
// ---------------------------------------------------------------------------

const addressSchema = z.object({
  street: z.string().trim().min(2, "Ingresá la calle").max(120),
  number: z.string().trim().min(1, "Ingresá la altura").max(12),
  floor: z.string().trim().max(40).optional().default(""),
  city: z.string().trim().min(2, "Ingresá la ciudad o localidad").max(80),
  province: z.string().trim().min(1, "Elegí la provincia").max(60),
  postal_code: z
    .string()
    .trim()
    .regex(/^([A-Za-z]?\d{4}[A-Za-z]{0,3})$/, "Revisá el código postal: 4 números (ej. 1425) o CPA (ej. C1425ABC)."),
  notes: z.string().trim().max(300).optional().default(""),
});

export type AddressInput = z.input<typeof addressSchema>;

export interface ShippingQuoteResult {
  zone: { id: string; name: string; cost: number; freeOver: number | null; eta: string | null } | null;
  /** Costo con el subtotal enviado (0 si alcanza el envío gratis). */
  cost: number;
  point: { lat: number; lng: number } | null;
}

async function quote(address: z.output<typeof addressSchema>, subtotal: number): Promise<ShippingQuoteResult> {
  const zones = await fetchShippingZonesFresh();
  const q = await quoteShipping({
    zones,
    address: { street: address.street, number: address.number, city: address.city, province: address.province, postal_code: address.postal_code },
    subtotal,
  });
  const r = q.resolution;
  return {
    zone: r ? { id: r.zone.id, name: r.zone.name, cost: r.zone.cost, freeOver: r.freeOver, eta: r.eta } : null,
    cost: r?.cost ?? 0,
    point: q.point,
  };
}

export async function quoteShippingAction(input: unknown): Promise<ActionResult<ShippingQuoteResult>> {
  const parsed = z.object({ address: addressSchema, subtotal: z.number().nonnegative() }).safeParse(input);
  if (!parsed.success) return zodFail(parsed.error, "Revisá la dirección.");
  try {
    return ok(await quote(parsed.data.address, parsed.data.subtotal));
  } catch (err) {
    console.error(err);
    return fail("No pudimos calcular el envío. Probá de nuevo en un momento.");
  }
}

// ---------------------------------------------------------------------------
// Crear el pedido
// ---------------------------------------------------------------------------

const orderSchema = z
  .object({
    customer: z.object({
      name: z.string().trim().min(2, "Ingresá tu nombre y apellido").max(120),
      email: z.string().trim().toLowerCase().email("Revisá el email: tiene que tener el formato nombre@dominio.com").max(160),
      phone: z.string().trim().max(40).optional().default(""),
      doc: z.string().trim().max(20).optional().default(""),
    }),
    fulfillment: z.enum(["delivery", "pickup"]),
    address: addressSchema.nullish(),
    pickupLocationId: uuid.nullish(),
    paymentMethodCode: z.string().min(1, "Elegí cómo pagás").max(40),
    couponCode: z.string().trim().max(40).nullish(),
    notes: z.string().trim().max(1000).optional().default(""),
    items: z.array(z.object({ variantId: uuid, qty: z.number().int().min(1).max(999) })).min(1, "Tu carrito está vacío").max(100),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery" && !v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Completá la dirección de entrega" });
    if (v.fulfillment === "pickup" && !v.pickupLocationId) ctx.addIssue({ code: "custom", path: ["pickupLocationId"], message: "Elegí dónde retirás" });
    const digits = v.customer.phone.replace(/\D/g, "");
    if (v.customer.phone && (digits.length < 8 || digits.length > 15)) {
      ctx.addIssue({ code: "custom", path: ["customer", "phone"], message: "Revisá el teléfono: tiene que tener código de área (ej. 11 5555 1234)." });
    }
    if (v.customer.doc && !/^\d{7,11}$/.test(v.customer.doc.replace(/[.\-\s]/g, ""))) {
      ctx.addIssue({ code: "custom", path: ["customer", "doc"], message: "Revisá el DNI o CUIT: sólo números (7 a 11)." });
    }
  });

export type CreateOrderInput = z.input<typeof orderSchema>;

export interface CreateOrderResult {
  token: string;
  number: number;
  /** Link a WhatsApp con el pedido armado (método whatsapp). */
  whatsappUrl: string | null;
  totals: Pick<CartTotals, "total">;
}

export async function createOrder(input: unknown): Promise<ActionResult<CreateOrderResult>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;

  try {
    const [settings, methods, promotions, fresh] = await Promise.all([
      fetchSettingsFresh(),
      fetchPaymentMethodsFresh(),
      fetchActivePromotionsFresh(),
      getFreshVariants(data.items.map((i) => i.variantId)),
    ]);

    if (settings.checkout.require_phone && !data.customer.phone) {
      return fail("Ingresá tu teléfono.", { "customer.phone": ["Ingresá tu teléfono con código de área."] });
    }
    const method = methods.find((m) => m.code === data.paymentMethodCode);
    if (!method) return fail("El medio de pago elegido ya no está disponible. Elegí otro.");

    // --- Ítems frescos (precio y stock actuales)
    const itemErrors: Record<string, string[]> = {};
    const qtyByVariant = new Map<string, number>();
    for (const i of data.items) qtyByVariant.set(i.variantId, (qtyByVariant.get(i.variantId) ?? 0) + i.qty);
    for (const [variantId, qty] of qtyByVariant) {
      const v = fresh.get(variantId);
      const label = v ? (v.variantTitle ? `${v.name} (${v.variantTitle})` : v.name) : "Un producto";
      if (!v || !v.active) itemErrors[`items.${variantId}`] = [`${label} ya no está disponible.`];
      else if (v.trackInventory && !v.allowBackorder && v.stock < qty) {
        itemErrors[`items.${variantId}`] = [v.stock <= 0 ? `${label} se quedó sin stock.` : `De ${label} quedan ${v.stock}.`];
      }
    }
    if (Object.keys(itemErrors).length) {
      return fail(Object.values(itemErrors)[0][0] + " Ajustá el carrito para seguir.", itemErrors);
    }
    const items = [...qtyByVariant].map(([variantId, qty]) => {
      const v = fresh.get(variantId)!;
      return { variantId, productId: v.productId, categoryIds: v.categoryIds, qty, listPrice: v.price, compareAtPrice: v.compareAtPrice };
    });

    // --- Cupón (validado en la DB)
    let coupon: Coupon | null = null;
    const base = computeCart({ items, promotions });
    if (data.couponCode) {
      const lines = base.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice }));
      const result = await validateCouponServer(data.couponCode, lines, base.merchandiseTotal, data.customer.email);
      if ("reason" in result) return fail(`${result.reason}. Sacalo o probá con otro.`, { couponCode: [result.reason] });
      coupon = result.coupon;
    }
    const withCoupon = computeCart({ items, promotions, coupon });

    // --- Entrega
    let zone: ShippingQuoteResult["zone"] = null;
    let point: ShippingQuoteResult["point"] = null;
    let pickupName: string | null = null;
    if (data.fulfillment === "delivery" && data.address) {
      const q = await quote(data.address, withCoupon.merchandiseTotal);
      zone = q.zone;
      point = q.point;
      if (!zone && method.type !== "whatsapp") {
        return fail("Todavía no llegamos a tu zona. Elegí retirar en el local o acordá el envío por WhatsApp.", {
          address: ["Todavía no llegamos a esta dirección."],
        });
      }
    } else if (data.fulfillment === "pickup") {
      const pickup = (await fetchPickupLocationsFresh()).find((p) => p.id === data.pickupLocationId);
      if (!pickup) return fail("El punto de retiro elegido ya no está disponible.");
      pickupName = pickup.name;
    }

    const totals = computeCart({
      items,
      promotions,
      coupon,
      paymentMethod: { code: method.code, discountPercent: method.discountPercent },
      shipping: zone ? { cost: zone.cost, freeOver: zone.freeOver } : data.fulfillment === "delivery" ? { cost: 0 } : null,
    });

    const min = settings.checkout.min_order_total;
    if (min > 0 && totals.merchandiseTotal < min) {
      return fail(`El pedido mínimo es de ${formatMoney(min)}. Sumá productos para seguir.`);
    }

    // --- Payload según el contrato de public.create_order(payload)
    const provinceCode = data.address ? normalizeProvince(data.address.province) : null;
    const payload = {
      customer: {
        name: data.customer.name,
        email: data.customer.email,
        phone: data.customer.phone || null,
        doc: data.customer.doc ? data.customer.doc.replace(/[.\-\s]/g, "") : null,
      },
      fulfillment: data.fulfillment,
      payment_method_code: method.code,
      items: totals.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
      lines: totals.lines.map((l) => ({ variant_id: l.variantId, unit_price: l.unitPrice })),
      coupon_code: coupon?.code ?? null,
      totals: { coupon_discount: totals.couponDiscount, total: totals.total },
      shipping_zone_id: zone?.id ?? null,
      shipping_zone_name: data.fulfillment === "delivery" ? (zone?.name ?? "A coordinar por WhatsApp") : null,
      shipping_cost: totals.shippingCost,
      shipping_address:
        data.fulfillment === "delivery" && data.address
          ? {
              street: data.address.street,
              number: data.address.number,
              floor: data.address.floor || null,
              city: data.address.city,
              province: provinceCode ? provinceName(provinceCode) : data.address.province,
              postal_code: data.address.postal_code.toUpperCase(),
              notes: data.address.notes || null,
              lat: point?.lat ?? null,
              lng: point?.lng ?? null,
            }
          : null,
      pickup_location_id: data.fulfillment === "pickup" ? data.pickupLocationId : null,
      notes: settings.checkout.order_notes_enabled ? data.notes || null : null,
    };

    const supabase = createPublicClient();
    const { data: created, error } = await supabase.rpc("create_order", { payload: payload as unknown as Json });
    if (error) {
      // Los `raise exception` de la función ya vienen en castellano y con el nombre del producto.
      const message = error.message?.trim();
      if (error.code === "P0001" && message) return fail(message);
      console.error("[create_order]", error);
      return fail(GENERIC_ERROR);
    }
    const result = (created ?? {}) as { number?: number; public_token?: string };
    if (!result.public_token || !result.number) return fail(GENERIC_ERROR);

    let whatsappUrl: string | null = null;
    if (method.type === "whatsapp" && settings.whatsapp_phone) {
      const order = await getOrderByToken(result.public_token);
      if (order) {
        whatsappUrl = waLink(
          settings.whatsapp_phone,
          buildOrderMessage({
            template: settings.checkout.whatsapp.message_template,
            number: order.number,
            storeName: settings.name,
            customerName: order.customer.name,
            items: order.items.map((i) => ({ name: i.name, variantTitle: i.variantTitle, qty: i.qty, total: i.total })),
            total: order.total,
            delivery: order.fulfillment === "pickup" ? `Retiro en ${pickupName ?? "el local"}` : deliveryText(order),
            payment: method.name,
            url: absoluteUrl(`/pedido/${order.token}`),
            currency: order.currency,
          }),
        );
      }
    }

    return ok({ token: result.public_token, number: result.number, whatsappUrl, totals: { total: totals.total } });
  } catch (err) {
    console.error(err);
    return fail(GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Botón de arrepentimiento (P0-14)
// ---------------------------------------------------------------------------

const withdrawalSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre y apellido").max(120),
  contact: z
    .string()
    .trim()
    .min(5, "Ingresá un email o un teléfono")
    .max(160)
    .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || v.replace(/\D/g, "").length >= 8, "Revisá el email o teléfono de contacto."),
  orderNumber: z
    .string()
    .trim()
    .max(12)
    .optional()
    .default("")
    .refine((v) => !v || /^#?\d{1,10}$/.test(v), "El número de pedido son sólo números (ej. 1043)."),
  reason: z.string().trim().max(1000).optional().default(""),
});

export interface WithdrawalState {
  status: "idle" | "ok" | "error";
  code?: string;
  orderFound?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, string>;
}

export async function submitWithdrawal(_prev: WithdrawalState, formData: FormData): Promise<WithdrawalState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
    orderNumber: String(formData.get("orderNumber") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };
  const parsed = withdrawalSchema.safeParse(values);
  if (!parsed.success) {
    const failure = zodFail(parsed.error);
    return { status: "error", error: failure.error, fieldErrors: failure.fieldErrors, values };
  }
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("create_withdrawal_request", {
      payload: {
        name: parsed.data.name,
        contact: parsed.data.contact,
        order_number: parsed.data.orderNumber.replace(/\D/g, "") || null,
        reason: parsed.data.reason || null,
      },
    });
    if (error) {
      if (error.code === "P0001" && error.message) return { status: "error", error: error.message, values };
      console.error("[arrepentimiento]", error);
      return { status: "error", error: GENERIC_ERROR, values };
    }
    const r = (data ?? {}) as { code?: string; order_found?: boolean };
    if (!r.code) return { status: "error", error: GENERIC_ERROR, values };
    return { status: "ok", code: r.code, orderFound: Boolean(r.order_found) };
  } catch (err) {
    console.error(err);
    return { status: "error", error: GENERIC_ERROR, values };
  }
}
