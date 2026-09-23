import "server-only";

import { createHash, createHmac } from "node:crypto";

import { emailEnabled } from "@/lib/email/send";
import { createPublicClient } from "@/lib/supabase/server";

import { isMissingSchemaError } from "./checkout-sessions";

/**
 * ¿El checkout ofrece "Avisame por mail si dejo el pedido sin terminar"?
 * Tienda activa + Configuración › Pagos y checkout prendido + plan con
 * `marketing.abandoned` (RPC `checkout_reminders_enabled`, migración 0020).
 * Además tienen que poder salir los mails (`RESEND_API_KEY` y la clave de
 * servicio que usa el cron): no se pide un consentimiento para un aviso que
 * nunca va a llegar. Sin la migración, o ante cualquier error: false.
 */
export async function checkoutRemindersEnabled(storeId: string, configured: boolean): Promise<boolean> {
  if (!configured || !emailEnabled() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return false;
  try {
    const { data, error } = await createPublicClient().rpc("checkout_reminders_enabled", { p_store_id: storeId });
    if (error) {
      if (!isMissingSchemaError(error)) console.error("[carritos] habilitado:", error.code, error.message);
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Sal fija del hash de IP cuando no hay secreto configurado (documentada en
 * docs/DEPLOY.md §4d). Sin secreto el hash de un día + tienda + IP se puede
 * recalcular probando IPs; con `HASH_SECRET` (o `CRON_SECRET`) no.
 */
export const IP_HASH_FALLBACK_SALT = "ecommy-checkout-ip-v1";

/**
 * Hash del IP para los cupos de `upsert_checkout_session` (obligatorio en la
 * RPC): HMAC-SHA256 de día + tienda + IP con `HASH_SECRET` o, si falta,
 * `CRON_SECRET`; sin ninguno, SHA-256 con sal fija. Cambia cada día (UTC) y
 * por tienda: no sirve para seguir a nadie entre tiendas ni entre días. Sin
 * IP (no debería pasar detrás de Vercel) se usa "sin-ip": comparten el cupo.
 */
export function checkoutIpHash(
  ip: string | null | undefined,
  storeId: string,
  now: Date = new Date(),
  secret: string | undefined = process.env.HASH_SECRET?.trim() || process.env.CRON_SECRET?.trim(),
): string {
  const day = now.toISOString().slice(0, 10);
  const message = `checkout-session|${day}|${storeId}|${ip?.trim() || "sin-ip"}`;
  const digest = secret
    ? createHmac("sha256", secret).update(message).digest("hex")
    : createHash("sha256").update(`${IP_HASH_FALLBACK_SALT}|${message}`).digest("hex");
  return digest.slice(0, 32);
}

/** IP del visitante: primera de `x-forwarded-for` (Vercel) o `x-real-ip`. */
export function clientIp(h: Pick<Headers, "get">): string | null {
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return ip || null;
}

/** Path de las cookies del link del mail: `/carrito` de la tienda (con su prefijo). */
export function recoverCookiePath(basePath: string): string {
  return `${basePath}/carrito`;
}
