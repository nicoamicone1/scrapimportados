import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Firma de los Webhooks de MercadoPago (`x-signature`).
 *
 * Formato implementado (doc "Notificaciones › Webhooks › Validar origen" y
 * `WebhookSignatureValidator` del SDK oficial de Node, mercadopago/sdk-nodejs
 * src/utils/webhook/index.ts, revisado el 2026-09-23):
 *
 *   x-signature: ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
 *   manifest   : id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *   v1         = hex(HMAC-SHA256(secreto del webhook, manifest))
 *
 * - `data.id` sale del query string de la URL de la notificación (`?data.id=…`);
 *   si no viene, se usa `data.id` del cuerpo.
 * - Las partes que no vienen (sin `data.id` o sin `x-request-id`) se omiten
 *   del manifest, con su `;`.
 * - La doc pide `data.id` en minúsculas si es alfanumérico; el SDK lo usa tal
 *   cual. Se acepta cualquiera de las dos variantes (ambas exigen el secreto).
 * - No se exige ventana de tiempo sobre `ts`: un reenvío sólo dispara una
 *   relectura del recurso en MP (nunca se confía en el cuerpo) y los eventos
 *   son idempotentes por `event_id`.
 */

export interface SignatureInput {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
  secret: string;
}

/** `ts=…,v1=…` → partes (claves en minúscula; ignora las desconocidas). */
export function parseSignatureHeader(header: string): { ts: string | null; v1: string | null } {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (!value) continue;
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  return { ts, v1 };
}

/** `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` sin las partes ausentes. */
export function buildManifest(dataId: string | null | undefined, requestId: string | null | undefined, ts: string): string {
  const parts: string[] = [];
  const id = dataId?.trim();
  const req = requestId?.trim();
  if (id) parts.push(`id:${id}`);
  if (req) parts.push(`request-id:${req}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(";")};`;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac("sha256", secret).update(manifest, "utf8").digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b.toLowerCase(), "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** ¿La notificación la firmó MercadoPago con nuestro secreto? */
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }: SignatureInput): boolean {
  if (!secret || !xSignature?.trim()) return false;
  const { ts, v1 } = parseSignatureHeader(xSignature);
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const ids = new Set([dataId?.trim() ?? "", dataId?.trim().toLowerCase() ?? ""]);
  for (const id of ids) {
    if (safeEqualHex(signManifest(buildManifest(id, xRequestId, ts), secret), v1)) return true;
  }
  return false;
}
