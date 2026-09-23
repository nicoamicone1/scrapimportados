import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * `Authorization: Bearer $CRON_SECRET` en tiempo constante: se comparan los
 * SHA-256 (mismo largo siempre), así la respuesta no revela cuántos
 * caracteres del secreto coinciden. Sin secreto configurado, nadie pasa.
 */
export function cronAuthorized(header: string | null, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret || header === null) return false;
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
