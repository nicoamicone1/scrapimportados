import "server-only";

import { paymentsTokenKey } from "./config";
import { openToken, sealToken } from "./crypto";

/*
 * Estado del "Conectar Mercado Pago" entre /oauth/start y /oauth/callback:
 * cookie httpOnly cifrada (AES-GCM con PAYMENTS_TOKEN_KEY) con el `state`, el
 * `code_verifier` de PKCE, la tienda y el usuario. Vence a los 10 minutos.
 */

export const OAUTH_COOKIE = "ecommy_mp_oauth";
export const OAUTH_COOKIE_PATH = "/api/payments/mercadopago/oauth";
export const OAUTH_TTL_S = 600;

export interface OAuthState {
  state: string;
  verifier: string;
  storeId: string;
  userId: string;
  exp: number;
}

export function sealOAuthState(s: OAuthState): string {
  const key = paymentsTokenKey();
  if (!key) throw new Error("Falta PAYMENTS_TOKEN_KEY");
  return sealToken(JSON.stringify(s), key);
}

export function openOAuthState(value: string | undefined, now = Date.now()): OAuthState | null {
  const key = paymentsTokenKey();
  if (!key || !value) return null;
  const raw = openToken(value, key);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as OAuthState;
    if (!s.state || !s.verifier || !s.storeId || !s.userId || !(s.exp > now)) return null;
    return s;
  } catch {
    return null;
  }
}
