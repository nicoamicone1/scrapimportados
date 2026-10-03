import "server-only";

/*
 * Configuración del cobro online de las tiendas (docs/PAYMENTS.md §2).
 * Es OTRA aplicación de Mercado Pago que la del cobro de planes
 * (src/lib/billing): "Ecommy Tiendas", Checkout Pro con OAuth.
 */

export function mpPaymentsClientId(): string | null {
  return process.env.MP_PAYMENTS_CLIENT_ID?.trim() || null;
}

export function mpPaymentsClientSecret(): string | null {
  return process.env.MP_PAYMENTS_CLIENT_SECRET?.trim() || null;
}

/** Clave secreta de webhooks de la app (opcional: el pago se relee siempre en MP). */
export function mpPaymentsWebhookSecret(): string | null {
  return process.env.MP_PAYMENTS_WEBHOOK_SECRET?.trim() || null;
}

/** `PAYMENTS_TOKEN_KEY`: 32 bytes en base64 (cifra los tokens de los comercios). */
export function paymentsTokenKey(): Buffer | null {
  const raw = process.env.PAYMENTS_TOKEN_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

/** ¿Se puede ofrecer "Conectar Mercado Pago"? */
export function paymentsEnabled(): boolean {
  return Boolean(mpPaymentsClientId() && mpPaymentsClientSecret() && paymentsTokenKey() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
