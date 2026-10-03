import { NextResponse, type NextRequest } from "next/server";

import { revalidateTag } from "next/cache";

import { verifyWebhookSignature } from "@/lib/billing/signature";
import { tagFor } from "@/lib/cache-tags";
import { notifyOrderEvent } from "@/lib/email/notify";
import { paymentsDb } from "@/lib/payments/accounts";
import { mpPaymentsWebhookSecret, paymentsEnabled } from "@/lib/payments/config";
import { isRetryable, supabasePaymentsRepo } from "@/lib/payments/repo";
import { processPaymentNotification } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ID = /^\d{1,20}$/;

/**
 * Avisos de pagos de las tiendas (docs/PAYMENTS.md §4). La URL la arma cada
 * preferencia: `?store=<store_id>`. El `store` sólo elige qué token usar: el
 * pago se relee en MP y tiene que ser de esa cuenta y de un pedido de esa tienda.
 *
 * - Sin configuración → 503.
 * - Con `MP_PAYMENTS_WEBHOOK_SECRET` y `x-signature` → se valida (401 si no da).
 * - 200 salvo fallas transitorias (MP caído, 429, base sin responder) → 500
 *   para que MP reintente. Aplicar dos veces es idempotente (índice único).
 * - Acepta el formato nuevo (`type=payment`, `data.id`) y el IPN viejo
 *   (`topic=payment`, `id`). Los avisos de `merchant_order` se ignoran.
 */
export async function POST(request: NextRequest) {
  if (!paymentsEnabled()) return NextResponse.json({ error: "Cobro online no configurado" }, { status: 503 });

  const params = request.nextUrl.searchParams;
  const raw = await request.text();
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as typeof body;
  } catch {
    body = {};
  }

  const type = body.type ?? params.get("type") ?? params.get("topic");
  const bodyId = body.data?.id;
  const dataId = params.get("data.id") ?? (bodyId === undefined || bodyId === null ? null : String(bodyId)) ?? params.get("id");

  const secret = mpPaymentsWebhookSecret();
  const signature = request.headers.get("x-signature");
  if (secret && signature) {
    const valid = verifyWebhookSignature({ xSignature: signature, xRequestId: request.headers.get("x-request-id"), dataId, secret });
    if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const storeId = params.get("store") ?? "";
  if (type !== "payment" || !dataId || !ID.test(dataId)) return NextResponse.json({ ok: true, ignored: true });

  const db = paymentsDb();
  if (!db) return NextResponse.json({ error: "Cobro online no configurado" }, { status: 503 });

  try {
    const result = await processPaymentNotification(storeId, dataId, supabasePaymentsRepo(db));
    if (result.outcome === "ignored") {
      console.info(`[payments] pago ${dataId} (${storeId}): ignorado · ${result.reason}`);
      return NextResponse.json({ ok: true, outcome: "ignored" });
    }
    console.info(`[payments] pago ${dataId} (${storeId}): ${result.status} · ${result.result.payment_status ?? "?"}`);
    // Con stock al pagar (`on_paid`) el pago puede descontar unidades.
    if (result.result.applied) revalidateTag(tagFor("products", storeId), "max");
    if (result.result.notify && result.result.payment_status === "paid" && result.result.public_token) {
      const { data: store } = await db.from("stores").select("id, slug, custom_domain, custom_domain_verified").eq("id", storeId).maybeSingle();
      if (store) notifyOrderEvent(store, { id: result.orderId, public_token: result.result.public_token }, "paid");
    }
    return NextResponse.json({ ok: true, outcome: result.status });
  } catch (err) {
    console.error(`[payments] pago ${dataId} (${storeId}):`, err instanceof Error ? err.message : err);
    if (!isRetryable(err)) return NextResponse.json({ ok: true, outcome: "ignored" });
    return NextResponse.json({ error: "No se pudo procesar el aviso" }, { status: 500 });
  }
}
