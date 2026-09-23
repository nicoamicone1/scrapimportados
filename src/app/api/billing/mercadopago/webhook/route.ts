import { after, NextResponse, type NextRequest } from "next/server";

import { mpAccessToken, mpWebhookSecret } from "@/lib/billing/mercadopago";
import { sendBillingEmail } from "@/lib/billing/notify";
import { billingServiceClient } from "@/lib/billing/service";
import { verifyWebhookSignature } from "@/lib/billing/signature";
import { describeResult, isRetryableBillingError, processNotification, supabaseBillingRepo } from "@/lib/billing/sync";
import { isSubscriptionEvent, type MpNotification } from "@/lib/billing/types";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ID = /^[A-Za-z0-9_-]{1,80}$/;

/**
 * Webhook de MercadoPago Suscripciones (docs/BILLING.md).
 *
 * - Sin `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` → 503.
 * - Firma `x-signature` inválida o con `ts` a más de 10 minutos → 401
 *   (src/lib/billing/signature.ts).
 * - Firma válida → 200, aunque el aviso no nos interese (pagos sueltos,
 *   `subscription_preapproval_plan`, etc.) o no se pueda aplicar (4xx de MP,
 *   regla de negocio de la base): queda en `billing_events` como ignorado con
 *   el motivo. Excepción: falla transitoria (MP caído o con 429, la base sin
 *   responder) → 500, para que MP lo reintente (el evento queda sin
 *   `processed_at`). Ver `isRetryableBillingError`.
 * - `subscription_preapproval` / `subscription_authorized_payment`: se relee el
 *   recurso en MP y se aplica (src/lib/billing/sync.ts). Idempotente por el
 *   `id` de la notificación.
 * - Mails al dueño (activado / no pudimos cobrar) con `after()`.
 */
export async function POST(request: NextRequest) {
  const secret = mpWebhookSecret();
  if (!mpAccessToken() || !secret) {
    return NextResponse.json({ error: "Cobro con MercadoPago no configurado" }, { status: 503 });
  }

  const raw = await request.text();
  let body: MpNotification = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as MpNotification;
  } catch {
    body = {};
  }

  const params = request.nextUrl.searchParams;
  const bodyDataId = body.data?.id;
  const dataId = params.get("data.id") ?? (bodyDataId === undefined || bodyDataId === null ? null : String(bodyDataId));
  const requestId = request.headers.get("x-request-id");
  const valid = verifyWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: requestId,
    dataId,
    secret,
  });
  if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  const type = body.type ?? params.get("type");
  if (!isSubscriptionEvent(type) || !dataId || !ID.test(dataId)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const db = billingServiceClient();
  if (!db) return NextResponse.json({ error: "Cobro con MercadoPago no configurado" }, { status: 503 });

  const notificationId = body.id === undefined || body.id === null ? null : String(body.id);
  const eventId = notificationId ?? `${type}:${dataId}:${requestId ?? "sin-request-id"}`;
  try {
    const result = await processNotification(
      { eventId, type, dataId, payload: body as unknown as Json },
      { repo: supabaseBillingRepo(db) },
    );
    console.info(`[billing] ${type} ${dataId}: ${describeResult(result)}`);
    if (result.outcome === "applied" && result.decision.email) {
      after(() => sendBillingEmail(db, result));
    }
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (err) {
    // Los errores de MercadoPagoError ya vienen sin token.
    console.error(`[billing] ${type} ${dataId}:`, err instanceof Error ? err.message : err);
    if (!isRetryableBillingError(err)) return NextResponse.json({ ok: true, outcome: "ignored" });
    return NextResponse.json({ error: "No se pudo procesar el aviso" }, { status: 500 });
  }
}
