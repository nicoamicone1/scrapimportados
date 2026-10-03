import "server-only";

import { billingServiceClient, type BillingDb } from "@/lib/billing/service";

import { paymentsTokenKey } from "./config";
import { openToken, sealToken } from "./crypto";
import { refreshAccessToken, type MpOAuthToken } from "./oauth";

/*
 * Cuenta de Mercado Pago de cada tienda (tabla store_payment_accounts, sólo
 * service_role). Los tokens se guardan cifrados (crypto.ts).
 */

export interface SellerAccount {
  storeId: string;
  mpUserId: number;
  liveMode: boolean;
  accessToken: string;
}

const REFRESH_BEFORE_MS = 15 * 24 * 3600_000;

export function paymentsDb(): BillingDb | null {
  return billingServiceClient();
}

function expiresAt(token: MpOAuthToken): string | null {
  return token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
}

/** Guarda (o reemplaza) la cuenta conectada y deja activo el método 'mercadopago'. */
export async function saveConnectedAccount(db: BillingDb, storeId: string, userId: string, token: MpOAuthToken): Promise<void> {
  const key = paymentsTokenKey();
  if (!key) throw new Error("Falta PAYMENTS_TOKEN_KEY");
  const now = new Date().toISOString();
  const { error } = await db.from("store_payment_accounts").upsert(
    {
      store_id: storeId,
      provider: "mercadopago",
      mp_user_id: token.user_id,
      public_key: token.public_key ?? null,
      live_mode: token.live_mode ?? true,
      access_token_enc: sealToken(token.access_token, key),
      refresh_token_enc: token.refresh_token ? sealToken(token.refresh_token, key) : null,
      token_expires_at: expiresAt(token),
      status: "connected",
      last_error: null,
      connected_by: userId,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "store_id,provider" },
  );
  if (error) throw new Error(`No se pudo guardar la cuenta de Mercado Pago: ${error.message}`);

  const { data: method } = await db
    .from("payment_methods")
    .select("id")
    .eq("store_id", storeId)
    .eq("code", "mercadopago")
    .maybeSingle();
  if (method) {
    const { error: upErr } = await db.from("payment_methods").update({ is_active: true, type: "mercadopago" }).eq("id", method.id);
    if (upErr) throw new Error(upErr.message);
    return;
  }
  const { data: last } = await db
    .from("payment_methods")
    .select("position")
    .eq("store_id", storeId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Al final de la lista: el dueño lo reordena en Configuración › Pagos.
  const { error: insErr } = await db.from("payment_methods").insert({
    store_id: storeId,
    code: "mercadopago",
    type: "mercadopago",
    name: "Tarjeta de crédito o débito",
    discount_percent: 0,
    instructions_md: "Pagás en Mercado Pago con tarjeta de crédito, débito o dinero en cuenta. Podés elegir cuotas.",
    is_active: true,
    position: (last?.position ?? 0) + 1,
  });
  if (insErr) throw new Error(insErr.message);
}

/** Desconecta: borra los tokens y apaga el método (los pedidos ya creados quedan). */
export async function disconnectAccount(db: BillingDb, storeId: string): Promise<void> {
  const { error: pmErr } = await db.from("payment_methods").update({ is_active: false }).eq("store_id", storeId).eq("code", "mercadopago");
  if (pmErr) throw new Error(pmErr.message);
  const { error } = await db
    .from("store_payment_accounts")
    .update({
      status: "disconnected",
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("store_id", storeId)
    .eq("provider", "mercadopago");
  if (error) throw new Error(error.message);
}

async function markError(db: BillingDb, storeId: string, message: string): Promise<void> {
  await db.from("payment_methods").update({ is_active: false }).eq("store_id", storeId).eq("code", "mercadopago");
  await db
    .from("store_payment_accounts")
    .update({ status: "error", last_error: message.slice(0, 300), updated_at: new Date().toISOString() })
    .eq("store_id", storeId)
    .eq("provider", "mercadopago");
}

/**
 * Token del comercio para llamar a MP en su nombre. Lo refresca si vence en
 * menos de 15 días (o con `force`). null si no hay cuenta conectada.
 */
export async function getSellerAccount(db: BillingDb, storeId: string, opts: { force?: boolean } = {}): Promise<SellerAccount | null> {
  const key = paymentsTokenKey();
  if (!key) return null;
  const { data: row } = await db
    .from("store_payment_accounts")
    .select("*")
    .eq("store_id", storeId)
    .eq("provider", "mercadopago")
    .maybeSingle();
  if (!row || row.status !== "connected" || !row.mp_user_id) return null;
  const base = { storeId, mpUserId: Number(row.mp_user_id), liveMode: row.live_mode };
  const accessToken = openToken(row.access_token_enc, key);
  if (!accessToken) {
    await markError(db, storeId, "No pudimos leer la conexión con Mercado Pago. Volvé a conectar la cuenta.");
    return null;
  }
  const expires = row.token_expires_at ? Date.parse(row.token_expires_at) : null;
  const stillValid = expires === null || expires > Date.now();
  const due = opts.force || (expires !== null && expires - Date.now() < REFRESH_BEFORE_MS);
  if (!due) return { ...base, accessToken };

  const refresh = openToken(row.refresh_token_enc, key);
  if (!refresh) {
    if (stillValid) return { ...base, accessToken };
    await markError(db, storeId, "La conexión con Mercado Pago venció. Volvé a conectar la cuenta.");
    return null;
  }
  try {
    const token = await refreshAccessToken(refresh);
    const { error } = await db
      .from("store_payment_accounts")
      .update({
        access_token_enc: sealToken(token.access_token, key),
        refresh_token_enc: token.refresh_token ? sealToken(token.refresh_token, key) : row.refresh_token_enc,
        token_expires_at: expiresAt(token),
        public_key: token.public_key ?? row.public_key,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId)
      .eq("provider", "mercadopago");
    if (error) throw new Error(error.message);
    return { ...base, accessToken: token.access_token };
  } catch (err) {
    console.error("[payments] refresh", storeId, err instanceof Error ? err.message : err);
    // Si todavía no venció, se sigue con el actual y se reintenta mañana.
    if (stillValid) return { ...base, accessToken };
    await markError(db, storeId, "La conexión con Mercado Pago venció. Volvé a conectar la cuenta.");
    return null;
  }
}

/** Cron diario: refresca los tokens que vencen en menos de 30 días. */
export async function refreshExpiringAccounts(db: BillingDb): Promise<{ checked: number; refreshed: number }> {
  const limit = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  const { data } = await db
    .from("store_payment_accounts")
    .select("store_id")
    .eq("provider", "mercadopago")
    .eq("status", "connected")
    .lt("token_expires_at", limit);
  let refreshed = 0;
  for (const row of data ?? []) {
    if (await getSellerAccount(db, row.store_id, { force: true })) refreshed++;
  }
  return { checked: data?.length ?? 0, refreshed };
}
