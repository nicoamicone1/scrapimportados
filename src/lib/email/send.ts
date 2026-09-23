/**
 * Envío de emails transaccionales por la API REST de Resend (sin SDK).
 *
 * - Sin `RESEND_API_KEY` no se manda nada: se avisa UNA vez por consola y se
 *   devuelve `{ skipped: true }` (dev, previews y tiendas sin configurar).
 * - Nunca lanza: un mail que falla no puede romper un pedido ni un cambio
 *   de estado. Los errores se loguean y se devuelven como `{ ok: false }`.
 * - Las tiendas mandan desde la dirección de Ecommy (`EMAIL_FROM`) con el
 *   nombre visible "{Tienda} vía Ecommy" y `replyTo` = email de la tienda:
 *   así el comprador responde a la tienda y el dominio que firma (SPF/DKIM)
 *   es siempre el de la plataforma.
 */

export const DEFAULT_EMAIL_FROM = "Ecommy <no-reply@ecommy.app>";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Remitente completo (`Nombre <dir@dominio>`). Por defecto `EMAIL_FROM`. */
  from?: string;
  replyTo?: string | string[] | null;
  tags?: EmailTag[];
  /**
   * Clave de idempotencia de Resend (24 h): el mismo envío repetido con la
   * misma clave no sale dos veces (reintentos, doble clic, cron repetido).
   */
  idempotencyKey?: string;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string } | { skipped: true };

let warnedMissingKey = false;

/** `true` si hay API key: sin ella no vale la pena ni cargar datos para armar el mail. */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Avisa UNA vez por proceso que los emails están apagados. */
export function warnEmailDisabled(): void {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  console.info("[email] RESEND_API_KEY no está configurada: los emails transaccionales no se envían.");
}

/** Sólo para tests. */
export function resetEmailWarnings(): void {
  warnedMissingKey = false;
}

/** Email con formato razonable (no valida RFC completo: eso lo hace Resend). */
export function isEmail(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/.test(value.trim());
}

/** Dirección pelada de un remitente `Nombre <dir@dominio>` (o la cadena tal cual). */
export function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

/** Nombre visible seguro para un encabezado `From` (sin comillas, saltos ni `<>`). */
export function displayName(name: string): string {
  return name.replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Remitente de la plataforma (`EMAIL_FROM` o el default). */
export function platformFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}

/** Remitente de una tienda: `"Taller Luna vía Ecommy" <no-reply@ecommy.app>`. */
export function storeFrom(storeName: string): string {
  const name = displayName(storeName);
  const address = addressOf(platformFrom());
  return name ? `"${name} vía Ecommy" <${address}>` : platformFrom();
}

/** Resend sólo acepta [A-Za-z0-9_-] en nombre y valor de los tags. */
function cleanTag(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

function recipients(value: string | string[] | null | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((v) => v.trim()).filter(isEmail);
}

function post(headers: Record<string, string>, body: string): Promise<Response> {
  return fetch(RESEND_ENDPOINT, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    warnEmailDisabled();
    return { skipped: true };
  }

  try {
    const to = recipients(message.to);
    if (!to.length) return { ok: false, error: "Sin destinatario válido" };
    const replyTo = recipients(message.replyTo);

    const body: Record<string, unknown> = {
      from: message.from || platformFrom(),
      to,
      subject: message.subject.replace(/[\r\n]+/g, " ").trim(),
      html: message.html,
      text: message.text,
    };
    if (replyTo.length) body.reply_to = replyTo;
    if (message.tags?.length) {
      body.tags = message.tags.map((t) => ({ name: cleanTag(t.name), value: cleanTag(t.value) }));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);

    const payload = JSON.stringify(body);
    let res = await post(headers, payload);
    // Resend limita a ~2 envíos por segundo por cuenta: ante un 429 se reintenta
    // hasta dos veces respetando `retry-after` (la idempotency key evita duplicados).
    for (let attempt = 0; res.status === 429 && attempt < 2; attempt++) {
      const wait = Math.min(Number(res.headers.get("retry-after")) * 1000 || 1000, 5000);
      await new Promise((resolve) => setTimeout(resolve, wait));
      res = await post(headers, payload);
    }
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
    if (!res.ok) {
      const error = data?.message || data?.name || `HTTP ${res.status}`;
      console.error(`[email] Resend rechazó "${body.subject}": ${error}`);
      return { ok: false, error };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] No se pudo enviar "${message.subject}": ${error}`);
    return { ok: false, error };
  }
}

/** ¿El envío salió? (`skipped` no cuenta). */
export function wasSent(result: SendResult): boolean {
  return "ok" in result && result.ok;
}
