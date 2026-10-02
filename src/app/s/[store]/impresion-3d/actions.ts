"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { fail, GENERIC_ERROR, ok, zodFail, type ActionResult } from "@/lib/actions";
import { notifyOrderCreated } from "@/lib/email/notify";
import { normalizeProvince, provinceName, quoteShipping } from "@/lib/shipping";
import { addressSchema, customerIssues, customerSchema } from "@/lib/store/checkout-input";
import { checkoutIpHash, clientIp } from "@/lib/store/checkout-reminders";
import { deliveryText, getOrderByToken } from "@/lib/store/orders";
import { fetchPaymentMethodsFresh } from "@/lib/store/payment-methods";
import { getPrint3dQuote } from "@/lib/store/print3d";
import { absoluteUrl } from "@/lib/store/seo";
import { fetchSettingsFresh } from "@/lib/store/settings";
import { fetchPickupLocationsFresh, fetchShippingZonesFresh } from "@/lib/store/shipping";
import { buildOrderMessage, waLink } from "@/lib/store/whatsapp";
import type { Json } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant/resolve";

/*
 * Taller 3D — acciones PÚBLICAS del cotizador (spec TALLER-3D §4).
 * La tienda sale del request (nunca del cliente). Precios, gramos, minutos y
 * revisión los recalcula la RPC con la misma fórmula del motor: lo que manda
 * el navegador es la geometría (ya escalada a mm) y lo que eligió.
 */

const STORE_UNAVAILABLE = "Esta tienda no está disponible en este momento.";

const uuid = z.string().uuid();
const finite = z.number().finite();

const geometrySchema = z.object({
  volume_mm3: finite.positive(),
  area_mm2: finite.positive(),
  bbox: z.tuple([finite.positive(), finite.positive(), finite.positive()]),
  triangles: z.number().int().min(4).max(50_000_000),
  manifold: z.boolean(),
});

const itemSchema = z.object({
  file_path: z.string().min(10).max(400),
  file_name: z.string().trim().min(1).max(200),
  file_size: z.number().int().positive().max(100 * 1024 * 1024),
  format: z.enum(["stl", "3mf"]),
  geometry: geometrySchema,
  material_id: uuid,
  color_id: uuid,
  quality_id: uuid,
  infill_pct: z.number().int().min(0).max(100),
  supports: z.boolean(),
  qty: z.number().int().min(1).max(500),
});

const contactSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().toLowerCase().max(160).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
});

const submitSchema = z
  .object({
    items: z.array(itemSchema).min(1, "Subí al menos una pieza.").max(20, "Hasta 20 piezas por cotización."),
    contact: contactSchema.nullish(),
    notes: z.string().trim().max(1000).optional().default(""),
    estimated_ready_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    /** El cliente ya sabe que va a revisión: el contacto es obligatorio. */
    needs_review: z.boolean().optional().default(false),
  })
  .superRefine((v, ctx) => {
    const c = v.contact;
    if (c?.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
      ctx.addIssue({ code: "custom", path: ["contact", "email"], message: "Revisá el email: tiene que tener el formato nombre@dominio.com." });
    }
    const digits = (c?.phone ?? "").replace(/\D/g, "");
    if (c?.phone && (digits.length < 8 || digits.length > 15)) {
      ctx.addIssue({ code: "custom", path: ["contact", "phone"], message: "Revisá el teléfono: tiene que tener código de área (ej. 11 5555 1234)." });
    }
    if (v.needs_review) {
      if (!c || c.name.length < 2) ctx.addIssue({ code: "custom", path: ["contact", "name"], message: "Decinos tu nombre." });
      if (!c || (!c.email && !c.phone)) {
        ctx.addIssue({ code: "custom", path: ["contact", "phone"], message: "Dejanos un WhatsApp o un email para responderte." });
      }
    }
  });

export type SubmitPrint3dQuoteInput = z.input<typeof submitSchema>;

async function requestIpHash(storeId: string): Promise<string> {
  try {
    return checkoutIpHash(clientIp(await headers()), storeId);
  } catch {
    return checkoutIpHash(null, storeId);
  }
}

/** Crea la cotización (RPC `print3d_submit_quote`) y devuelve el token para `/impresion-3d/c/<token>`. */
export async function submitPrint3dQuote(input: unknown): Promise<ActionResult<{ token: string; status: string; total: number }>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error, "Revisá los datos de la cotización.");
  const data = parsed.data;
  try {
    const store = (await getTenant()).store;
    if (!store) return fail(STORE_UNAVAILABLE);
    // La ruta del archivo tiene que ser de ESTA tienda (la RPC además chequea que exista en el bucket).
    const prefix = `${store.id}/q/`;
    if (data.items.some((i) => !i.file_path.startsWith(prefix) || i.file_path.includes(".."))) {
      return fail("Uno de los archivos no se subió bien. Sacalo y volvé a subirlo.");
    }
    const contact = data.contact && (data.contact.name || data.contact.email || data.contact.phone) ? data.contact : null;
    const { data: created, error } = await createPublicClient().rpc("print3d_submit_quote", {
      p_store_id: store.id,
      p_ip_hash: await requestIpHash(store.id),
      payload: {
        items: data.items,
        contact: contact ? { name: contact.name || null, email: contact.email || null, phone: contact.phone || null } : null,
        notes: data.notes || null,
        estimated_ready_date: data.estimated_ready_date ?? null,
      } as unknown as Json,
    });
    if (error) {
      const message = error.message?.trim();
      if (error.code === "P0001" && message) return fail(message);
      console.error("[taller-3d] cotizar:", error.code, error.message);
      return fail(GENERIC_ERROR);
    }
    const r = (created ?? {}) as { token?: string; status?: string; total?: number | string };
    if (!r.token) return fail(GENERIC_ERROR);
    return ok({ token: r.token, status: r.status ?? "priced", total: Number(r.total ?? 0) });
  } catch (err) {
    console.error("[taller-3d] cotizar:", err instanceof Error ? err.message : err);
    return fail(GENERIC_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Checkout de la cotización
// ---------------------------------------------------------------------------

const checkoutSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "El link de la cotización no es válido."),
    customer: customerSchema,
    fulfillment: z.enum(["delivery", "pickup"]),
    address: addressSchema.nullish(),
    pickupLocationId: uuid.nullish(),
    paymentMethodCode: z.string().min(1, "Elegí cómo pagás").max(40),
    notes: z.string().trim().max(1000).optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery" && !v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Completá la dirección de entrega" });
    if (v.fulfillment === "pickup" && !v.pickupLocationId) ctx.addIssue({ code: "custom", path: ["pickupLocationId"], message: "Elegí dónde retirás" });
    for (const issue of customerIssues(v.customer)) ctx.addIssue({ code: "custom", path: ["customer", issue.path], message: issue.message });
  });

export type CheckoutPrint3dQuoteInput = z.input<typeof checkoutSchema>;

export interface CheckoutPrint3dQuoteResult {
  token: string;
  number: number;
  whatsappUrl: string | null;
}

/**
 * Convierte una cotización `priced` en pedido (RPC `print3d_checkout_quote`),
 * con el mismo cliente/entrega/pago que `createOrder` y sin cupones ni promos.
 */
export async function checkoutPrint3dQuote(input: unknown): Promise<ActionResult<CheckoutPrint3dQuoteResult>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const data = parsed.data;
  try {
    const store = (await getTenant()).store;
    if (!store) return fail(STORE_UNAVAILABLE);
    const [settings, methods, quote] = await Promise.all([
      fetchSettingsFresh(store.id),
      fetchPaymentMethodsFresh(store.id),
      getPrint3dQuote(store.id, data.token),
    ]);
    if (!quote) return fail("No encontramos esta cotización.");
    if (quote.status !== "priced") {
      return fail(
        quote.status === "ordered"
          ? "Esta cotización ya se convirtió en pedido."
          : quote.status === "expired"
            ? "La cotización venció. Volvé a cotizar: los precios pueden haber cambiado."
            : "Esta cotización todavía no se puede pedir.",
      );
    }
    if (settings.checkout.require_phone && !data.customer.phone) {
      return fail("Ingresá tu teléfono.", { "customer.phone": ["Ingresá tu teléfono con código de área."] });
    }
    const method = methods.find((m) => m.code === data.paymentMethodCode);
    if (!method) return fail("El medio de pago elegido ya no está disponible. Elegí otro.");

    // --- Entrega (la RPC recalcula el costo con la zona; acá se resuelve cuál es)
    let zone: { id: string; name: string } | null = null;
    let point: { lat: number; lng: number } | null = null;
    let pickupName: string | null = null;
    if (data.fulfillment === "delivery" && data.address) {
      const q = await quoteShipping({
        zones: await fetchShippingZonesFresh(store.id),
        address: {
          street: data.address.street,
          number: data.address.number,
          city: data.address.city,
          province: data.address.province,
          postal_code: data.address.postal_code,
        },
        subtotal: quote.total,
      });
      zone = q.resolution ? { id: q.resolution.zone.id, name: q.resolution.zone.name } : null;
      point = q.point;
      if (!zone && method.type !== "whatsapp") {
        return fail("Todavía no llegamos a tu zona. Elegí retirar en el local o acordá el envío por WhatsApp.", {
          address: ["Todavía no llegamos a esta dirección."],
        });
      }
    } else if (data.fulfillment === "pickup") {
      const pickup = (await fetchPickupLocationsFresh(store.id)).find((p) => p.id === data.pickupLocationId);
      if (!pickup) return fail("El punto de retiro elegido ya no está disponible.");
      pickupName = pickup.name;
    }

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
      shipping_zone_id: zone?.id ?? null,
      shipping_zone_name: data.fulfillment === "delivery" ? (zone?.name ?? "A coordinar por WhatsApp") : null,
      shipping_cost: 0,
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

    const { data: created, error } = await createPublicClient().rpc("print3d_checkout_quote", {
      p_token: data.token,
      payload: payload as unknown as Json,
    });
    if (error) {
      const message = error.message?.trim();
      if (error.code === "P0001" && message) return fail(message);
      console.error("[taller-3d] checkout:", error.code, error.message);
      return fail(GENERIC_ERROR);
    }
    const result = (created ?? {}) as { number?: number; public_token?: string; notify_customer?: boolean };
    if (!result.public_token || !result.number) return fail(GENERIC_ERROR);
    // Igual que `createOrder`: "Recibimos tu pedido" + "Nuevo pedido", después de responder.
    notifyOrderCreated({ store, settings, token: result.public_token, notifyCustomer: result.notify_customer !== false });

    let whatsappUrl: string | null = null;
    if (method.type === "whatsapp" && settings.whatsapp_phone) {
      const order = await getOrderByToken(store.id, result.public_token);
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
            url: absoluteUrl(store, `/pedido/${order.token}`),
            currency: order.currency,
          }),
        );
      }
    }
    return ok({ token: result.public_token, number: result.number, whatsappUrl });
  } catch (err) {
    console.error("[taller-3d] checkout:", err instanceof Error ? err.message : err);
    return fail(GENERIC_ERROR);
  }
}
