import "server-only";

import { MercadoPagoError, mpRequest } from "@/lib/billing/mercadopago";
import type { BillingDb } from "@/lib/billing/service";
import type { Json } from "@/lib/supabase/database.types";

import { getSellerAccount } from "./accounts";
import type { ApplyResult, MpPayment, PaymentsRepo } from "./webhook";

/** Error que conviene que MP reintente (red, 5xx, 429, base caída). */
export class RetryablePaymentError extends Error {}

export function isRetryable(err: unknown): boolean {
  if (err instanceof RetryablePaymentError) return true;
  if (err instanceof MercadoPagoError) return err.status === 0 || err.status === 429 || err.status >= 500;
  return false;
}

export function supabasePaymentsRepo(db: BillingDb): PaymentsRepo {
  const tokens = new Map<string, string>();
  return {
    async getSeller(storeId) {
      const acc = await getSellerAccount(db, storeId);
      if (!acc) return null;
      tokens.set(storeId, acc.accessToken);
      return { mpUserId: acc.mpUserId };
    },
    async fetchPayment(storeId, paymentId) {
      const token = tokens.get(storeId);
      if (!token) throw new Error("Sin token del comercio");
      return mpRequest<MpPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, { token });
    },
    async getOrder(storeId, orderId) {
      const { data, error } = await db.from("orders").select("id, total, currency").eq("store_id", storeId).eq("id", orderId).maybeSingle();
      if (error) throw new RetryablePaymentError(error.message);
      return data ? { id: data.id, total: Number(data.total), currency: data.currency } : null;
    },
    async applyPayment(args) {
      const { data, error } = await db.rpc("payments_apply_mp_payment", {
        p_store_id: args.storeId,
        p_order_id: args.orderId,
        p_payment_id: args.paymentId,
        p_status: args.status,
        p_amount: args.amount,
        p_detail: args.detail as Json,
      });
      if (error) {
        if (error.code === "P0001") return { applied: false };
        throw new RetryablePaymentError(error.message);
      }
      return (data ?? { applied: false }) as unknown as ApplyResult;
    },
  };
}
