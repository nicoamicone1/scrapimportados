import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { MP_API, MercadoPagoError, redactTokens } from "@/lib/billing/mercadopago";
import { platformOrigin } from "@/lib/tenant/urls";

import { mpPaymentsClientId, mpPaymentsClientSecret } from "./config";

/*
 * OAuth de Mercado Pago (Authorization Code + PKCE S256) para conectar la
 * cuenta del comercio. Doc: "Seguridad › OAuth" de MP Developers.
 * La redirect URI es fija y está registrada en la app "Ecommy Tiendas".
 */

export const MP_AUTH_URL = "https://auth.mercadopago.com/authorization";
export const OAUTH_CALLBACK_PATH = "/api/payments/mercadopago/oauth/callback";

export function oauthRedirectUri(): string {
  return `${platformOrigin()}${OAUTH_CALLBACK_PATH}`;
}

export function newPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export function authorizationUrl(state: string, challenge: string): string {
  const clientId = mpPaymentsClientId();
  if (!clientId) throw new Error("Falta MP_PAYMENTS_CLIENT_ID");
  const url = new URL(MP_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", oauthRedirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface MpOAuthToken {
  access_token: string;
  refresh_token?: string;
  public_key?: string;
  user_id: number;
  expires_in?: number;
  live_mode?: boolean;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<MpOAuthToken> {
  const clientId = mpPaymentsClientId();
  const clientSecret = mpPaymentsClientSecret();
  if (!clientId || !clientSecret) throw new MercadoPagoError("POST", "/oauth/token", 0, "Faltan las credenciales de la app");
  let res: Response;
  try {
    res = await fetch(`${MP_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (err) {
    throw new MercadoPagoError("POST", "/oauth/token", 0, redactTokens(err instanceof Error ? err.message : String(err)));
  }
  const data = (await res.json().catch(() => null)) as (Partial<MpOAuthToken> & { message?: unknown; error?: unknown }) | null;
  if (!res.ok || !data?.access_token || !data.user_id) {
    const msg = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "";
    throw new MercadoPagoError("POST", "/oauth/token", res.status, redactTokens(msg).slice(0, 300));
  }
  return data as MpOAuthToken;
}

export function exchangeCode(code: string, verifier: string): Promise<MpOAuthToken> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: oauthRedirectUri(), code_verifier: verifier });
}

export function refreshAccessToken(refreshToken: string): Promise<MpOAuthToken> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}
