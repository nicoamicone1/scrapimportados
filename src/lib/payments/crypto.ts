import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * Cifrado de los tokens de Mercado Pago de los comercios (AES-256-GCM).
 * Formato: `v1.<iv>.<tag>.<data>` en base64url. La base nunca ve el texto plano.
 */

const VERSION = "v1";

export function sealToken(plain: string, key: Buffer): string {
  if (key.length !== 32) throw new Error("Clave de cifrado inválida");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

/** null si el texto no es de esta clave o fue alterado. */
export function openToken(sealed: string | null | undefined, key: Buffer): string | null {
  if (!sealed || key.length !== 32) return null;
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
