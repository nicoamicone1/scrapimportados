import "server-only";

import { MercadoPagoError } from "@/lib/billing/mercadopago";
import type { PublicOrder } from "@/lib/store/orders";
import type { StoreSettings } from "@/lib/store/settings";

import { getSellerAccount, paymentsDb } from "./accounts";
import { paymentsEnabled } from "./config";
import { createOrderPreference } from "./preferences";

export const PAYMENT_START_ERROR = "No pudimos abrir Mercado Pago. Probá de nuevo desde la página de tu pedido o elegí otro medio.";

/**
 * Link de pago de Checkout Pro para un pedido de la tienda (pedido nuevo o
 * "Reintentar pago"). Nunca lanza: devuelve el link o un mensaje para el comprador.
 */
export async function startMercadoPagoPayment(input: {
  storeId: string;
  settings: StoreSettings;
  order: PublicOrder;
  orderUrl: string;
}): Promise<{ url: string } | { error: string }> {
  const { order, settings } = input;
  if (!paymentsEnabled()) return { error: PAYMENT_START_ERROR };
  const db = paymentsDb();
  if (!db) return { error: PAYMENT_START_ERROR };
  try {
    const account = await getSellerAccount(db, input.storeId);
    if (!account) return { error: "Esta tienda no está cobrando con tarjeta en este momento. Coordiná el pago con la tienda." };
    const { data: ctx } = await db.rpc("payments_store_context", { p_store_id: input.storeId });
    const fee = Number((ctx as { fee_percent?: number } | null)?.fee_percent ?? 0);
    const mp = settings.checkout.mercadopago;
    const { url } = await createOrderPreference(db, account, {
      order: { id: order.id, number: order.number, total: order.total, currency: order.currency, expiresAt: order.expiresAt },
      storeId: input.storeId,
      storeName: settings.name,
      payer: { name: order.customer.name, email: order.customer.email },
      orderUrl: input.orderUrl,
      maxInstallments: mp.max_installments,
      binaryMode: mp.binary_mode,
      statementDescriptor: mp.statement_descriptor,
      feePercent: Number.isFinite(fee) ? fee : 0,
    });
    return { url };
  } catch (err) {
    console.error("[payments] preferencia", input.storeId, err instanceof MercadoPagoError || err instanceof Error ? err.message : err);
    return { error: PAYMENT_START_ERROR };
  }
}
