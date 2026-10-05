import "server-only";

import type { ReplyPayments, ReplyPickup, ReplyTerms, ReplyZone } from "@/lib/admin/replies";
import type { AdminContext } from "@/lib/auth";
import { fetchPaymentMethodsFresh, type StorePaymentMethod } from "@/lib/store/payment-methods";
import { parseCheckout } from "@/lib/store/settings";

import { freeShippingThreshold } from "@/components/admin/share/messages";

/**
 * Lecturas de `/admin/responder` (tienda activa, sin caché): las condiciones
 * que suman a cada respuesta y los datos de "Lo que preguntan siempre".
 * Descuento por transferencia y envío gratis se calculan igual que en
 * `/admin/compartir` (mayor % de transferencia activo; `freeShippingThreshold`).
 */
export interface ReplyDeskData {
  currency: string;
  maintenance: boolean;
  terms: ReplyTerms;
  zones: ReplyZone[];
  pickups: ReplyPickup[];
  /** Envío gratis que vale para todas las zonas activas (null = no hay). */
  freeShippingFrom: number | null;
  payments: ReplyPayments;
}

export async function getReplyDeskData(ctx: Pick<AdminContext, "supabase" | "store">): Promise<ReplyDeskData> {
  const { supabase, store } = ctx;
  const [settings, zones, pickups, methods] = await Promise.all([
    supabase.from("store_settings").select("currency, maintenance, checkout").eq("store_id", store.id).maybeSingle(),
    supabase
      .from("shipping_zones")
      .select("name, cost, free_over, eta_text, position")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("position"),
    supabase
      .from("pickup_locations")
      .select("name, address, hours_text, position")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("position"),
    // Los mismos métodos que ve el cliente: Mercado Pago sólo con la cuenta conectada.
    fetchPaymentMethodsFresh(store.id).catch((err: unknown): StorePaymentMethod[] => {
      console.error("[responder] métodos de pago:", err instanceof Error ? err.message : err);
      return [];
    }),
  ]);

  const currency = settings.data?.currency || "ARS";
  const maintenanceRaw = settings.data?.maintenance;
  const maintenance = Boolean(
    maintenanceRaw && typeof maintenanceRaw === "object" && !Array.isArray(maintenanceRaw) && maintenanceRaw.enabled === true,
  );
  const checkout = parseCheckout(settings.data?.checkout ?? {});

  const transferMethods = methods.filter((m) => m.type === "transfer");
  const transferDiscount = transferMethods.reduce((max, m) => Math.max(max, m.discountPercent || 0), 0);
  const card = methods.some((m) => m.type === "mercadopago");
  const freeInstallments = card ? Math.min(checkout.mercadopago.free_installments, checkout.mercadopago.max_installments) : 0;
  const cashMethods = methods.filter((m) => m.type === "cash");

  return {
    currency,
    maintenance,
    terms: { transferDiscount, freeInstallments, currency },
    zones: (zones.data ?? []).map((z) => ({
      name: z.name,
      cost: Number(z.cost),
      freeOver: z.free_over === null ? null : Number(z.free_over),
      etaText: z.eta_text,
    })),
    pickups: (pickups.data ?? []).map((p) => ({ name: p.name, address: p.address, hoursText: p.hours_text })),
    freeShippingFrom: freeShippingThreshold(zones.data ?? []),
    payments: {
      transfer: transferMethods.length > 0,
      transferDiscount,
      alias: checkout.transfer.alias,
      cbu: checkout.transfer.cbu,
      holder: checkout.transfer.holder,
      bankName: checkout.transfer.bank_name,
      card,
      freeInstallments,
      cash: cashMethods.length ? { discount: cashMethods.reduce((max, m) => Math.max(max, m.discountPercent || 0), 0) } : null,
      currency,
    },
  };
}
