import "server-only";

import type { MpAuthorizedPayment, MpPreapproval, MpPreapprovalPlan } from "./types";

/*
 * Cliente REST mínimo de MercadoPago (sin SDK, por `fetch`).
 *
 * - El access token (`MP_ACCESS_TOKEN`) sólo existe en el servidor: nunca
 *   `NEXT_PUBLIC_`, nunca en logs ni en mensajes de error (los errores llevan
 *   método, path, status y el `message` de MP, nada más).
 * - Sin token, `billingEnabled()` es false: la UI no ofrece MercadoPago y el
 *   webhook responde 503.
 */

export const MP_API = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

export function mpAccessToken(): string | null {
  return process.env.MP_ACCESS_TOKEN?.trim() || null;
}

export function mpWebhookSecret(): string | null {
  return process.env.MP_WEBHOOK_SECRET?.trim() || null;
}

/** ¿Hay credenciales para cobrar con MercadoPago? */
export function billingEnabled(): boolean {
  return mpAccessToken() !== null;
}

export class MercadoPagoError extends Error {
  readonly status: number;
  readonly mpMessage: string;
  constructor(method: string, path: string, status: number, mpMessage: string) {
    super(`MercadoPago ${method} ${path}: HTTP ${status}${mpMessage ? ` · ${mpMessage}` : ""}`);
    this.name = "MercadoPagoError";
    this.status = status;
    this.mpMessage = mpMessage;
  }
}

/** Saca del texto cualquier cosa con forma de access token (APP_USR-…, TEST-…). */
export function redactTokens(text: string): string {
  return text.replace(/\b(?:APP_USR|TEST)-[A-Za-z0-9-]{10,}/g, "[token]").replace(/Bearer\s+\S+/gi, "Bearer [token]");
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  /** Header `X-Idempotency-Key` (MP lo respeta en los POST). */
  idempotencyKey?: string;
  token?: string | null;
}

export async function mpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const token = options.token ?? mpAccessToken();
  if (!token) throw new MercadoPagoError(method, path, 0, "Falta MP_ACCESS_TOKEN");
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey.slice(0, 64);

  let res: Response;
  try {
    res = await fetch(`${MP_API}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new MercadoPagoError(method, path, 0, redactTokens(err instanceof Error ? err.message : String(err)));
  }
  const raw = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = (data ?? {}) as { message?: unknown; error?: unknown };
    const msg = typeof d.message === "string" ? d.message : typeof d.error === "string" ? d.error : "";
    throw new MercadoPagoError(method, path, res.status, redactTokens(msg).slice(0, 300));
  }
  return data as T;
}

const seg = (id: string) => encodeURIComponent(id);

export interface CreatePreapprovalBody {
  preapproval_plan_id?: string;
  payer_email: string;
  external_reference: string;
  back_url: string;
  reason: string;
  status?: "pending";
  auto_recurring?: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
}

export function createPreapproval(body: CreatePreapprovalBody, idempotencyKey?: string): Promise<MpPreapproval> {
  return mpRequest<MpPreapproval>("/preapproval", { method: "POST", body, idempotencyKey });
}

export function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpRequest<MpPreapproval>(`/preapproval/${seg(id)}`);
}

export function cancelPreapproval(id: string): Promise<MpPreapproval> {
  return mpRequest<MpPreapproval>(`/preapproval/${seg(id)}`, { method: "PUT", body: { status: "cancelled" } });
}

export function getPreapprovalPlan(id: string): Promise<MpPreapprovalPlan> {
  return mpRequest<MpPreapprovalPlan>(`/preapproval_plan/${seg(id)}`);
}

export function getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
  return mpRequest<MpAuthorizedPayment>(`/authorized_payments/${seg(id)}`);
}
