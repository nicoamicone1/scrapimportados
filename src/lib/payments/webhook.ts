/*
 * Avisos de pagos de Mercado Pago de las tiendas (docs/PAYMENTS.md §4–5).
 *
 * Nunca se confía en el cuerpo del aviso ni en la vuelta del comprador: se
 * relee el pago con el token del comercio y se exige que
 *   - sea de esa cuenta (`collector_id` = `mp_user_id`),
 *   - su `external_reference` sea un pedido de la tienda,
 *   - la moneda coincida y, para aprobarlo, el monto cubra el total.
 * La lógica es pura sobre un `PaymentsRepo` (tests con repos falsos).
 */

import { mpMethodName } from "@/lib/store/mercadopago-labels";

export interface MpPayment {
  id: number | string;
  status?: string;
  status_detail?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string | null;
  collector_id?: number | string | null;
  installments?: number | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  card?: { last_four_digits?: string | null } | null;
  date_approved?: string | null;
}

export interface WebhookOrder {
  id: string;
  total: number;
  currency: string;
}

export interface ApplyArgs {
  storeId: string;
  orderId: string;
  paymentId: string;
  status: string;
  amount: number;
  detail: Record<string, unknown>;
}

export interface ApplyResult {
  applied: boolean;
  payment_status?: string;
  order_number?: number;
  public_token?: string;
  notify?: boolean;
}

export interface PaymentsRepo {
  getSeller(storeId: string): Promise<{ mpUserId: number } | null>;
  fetchPayment(storeId: string, paymentId: string): Promise<MpPayment>;
  getOrder(storeId: string, orderId: string): Promise<WebhookOrder | null>;
  applyPayment(args: ApplyArgs): Promise<ApplyResult>;
}

export type WebhookOutcome =
  | { outcome: "applied"; status: string; result: ApplyResult; orderId: string }
  | { outcome: "ignored"; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "6 cuotas · Visa ••4242" para la nota del pago. */
export function paymentSummary(p: MpPayment): string {
  const name = mpMethodName(p.payment_method_id);
  const last4 = p.card?.last_four_digits;
  const card = name ? (last4 ? `${name} ••${last4}` : name) : "";
  const n = p.installments ?? 0;
  return [n > 1 ? `${n} cuotas` : "", card].filter(Boolean).join(" · ");
}

export function paymentDetail(p: MpPayment): Record<string, unknown> {
  return {
    status: p.status ?? null,
    status_detail: p.status_detail ?? null,
    installments: p.installments ?? null,
    payment_method_id: p.payment_method_id ?? null,
    payment_type_id: p.payment_type_id ?? null,
    last_four: p.card?.last_four_digits ?? null,
    amount: p.transaction_amount ?? null,
    date_approved: p.date_approved ?? null,
    summary: paymentSummary(p),
  };
}

export async function processPaymentNotification(storeId: string, paymentId: string, repo: PaymentsRepo): Promise<WebhookOutcome> {
  if (!UUID.test(storeId)) return { outcome: "ignored", reason: "store_invalid" };
  if (!/^\d{1,20}$/.test(paymentId)) return { outcome: "ignored", reason: "payment_id_invalid" };

  const seller = await repo.getSeller(storeId);
  if (!seller) return { outcome: "ignored", reason: "no_account" };

  const payment = await repo.fetchPayment(storeId, paymentId);
  if (String(payment.collector_id ?? "") !== String(seller.mpUserId)) return { outcome: "ignored", reason: "other_collector" };

  const orderId = (payment.external_reference ?? "").trim();
  if (!UUID.test(orderId)) return { outcome: "ignored", reason: "no_reference" };
  const order = await repo.getOrder(storeId, orderId);
  if (!order) return { outcome: "ignored", reason: "order_not_found" };
  if ((payment.currency_id ?? order.currency) !== order.currency) return { outcome: "ignored", reason: "currency_mismatch" };

  const amount = Number(payment.transaction_amount ?? 0);
  let status = payment.status ?? "unknown";
  if (status === "approved" && amount < order.total - 0.01) status = "amount_mismatch";

  const result = await repo.applyPayment({
    storeId,
    orderId,
    paymentId: String(payment.id ?? paymentId),
    status,
    amount,
    detail: { ...paymentDetail(payment), status },
  });
  return { outcome: "applied", status, result, orderId };
}
