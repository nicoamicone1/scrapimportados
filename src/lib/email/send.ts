import "server-only";

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
/** Resend admite ~2 pedidos por segundo por cuenta: se espacian los envíos del proceso. */
const MIN_GAP_MS = 550;
/** Espera base antes de reintentar (429 / 5xx / red) si no viene `retry-after`. */
const RETRY_BASE_MS = 1_000;
const MAX_RETRIES = 2;

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

/**
 * Enmascara direcciones de email para los logs: `lucia@example.com` →
 * `l***@example.com`. Los mensajes de error de Resend suelen citar el
 * destinatario (dato personal del comprador) y los logs los ve todo el equipo.
 */
export function maskEmails(text: string): string {
  return text.replace(/([^\s@<>"'(),;:[\]]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (_, local: string, domain: string) => `${local.slice(0, 1)}***@${domain}`);
}

/** Resend sólo acepta [A-Za-z0-9_-] en nombre y valor de los tags. */
function cleanTag(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

function recipients(value: string | string[] | null | undefined): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map((v) => v.trim()).filter(isEmail);
}

let timing = { gap: MIN_GAP_MS, retry: RETRY_BASE_MS };
let nextSlot = 0;

/** Sólo para tests: sin esperas entre envíos ni antes de reintentar. */
export function setEmailTimingForTests(value: { gap: number; retry: number } | null): void {
  timing = value ?? { gap: MIN_GAP_MS, retry: RETRY_BASE_MS };
  nextSlot = 0;
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Turno para el próximo pedido a Resend. Una acción masiva (marcar 30 pedidos
 * como pagados) agenda 30 mails a la vez: sin esto, casi todos rebotan con 429.
 */
function waitForSlot(): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + timing.gap;
  return sleep(start - now);
}

function post(headers: Record<string, string>, body: string): Promise<Response> {
  return fetch(RESEND_ENDPOINT, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

function retryDelay(res: Response | null, attempt: number): number {
  const header = Number(res?.headers.get("retry-after"));
  const base = Number.isFinite(header) && header > 0 ? header * 1000 : timing.retry * (attempt + 1);
  return Math.min(base, 5_000);
}

/** Cuerpo de la respuesta para el log: JSON de Resend o texto, recortado. */
async function readBody(res: Response): Promise<{ data: { id?: string; message?: string; name?: string } | null; raw: string }> {
  const raw = await res.text().catch(() => "");
  try {
    return { data: raw ? (JSON.parse(raw) as { id?: string; message?: string; name?: string }) : null, raw };
  } catch {
    return { data: null, raw };
  }
}

function labelOf(message: EmailMessage): string {
  const kind = message.tags?.find((t) => t.name === "kind")?.value;
  return kind ? `"${kind}"` : "(sin tipo)";
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    warnEmailDisabled();
    return { skipped: true };
  }
  const label = labelOf(message);

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
    const idempotent = Boolean(message.idempotencyKey);
    if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);
    const payload = JSON.stringify(body);

    // Reintentos: 429 siempre (Resend no lo procesó). 5xx, timeout o error de red
    // sólo con idempotency key (si el primer intento sí salió, Resend no lo repite).
    for (let attempt = 0; ; attempt++) {
      await waitForSlot();
      let res: Response;
      try {
        res = await post(headers, payload);
      } catch (err) {
        if (idempotent && attempt < MAX_RETRIES) {
          await sleep(retryDelay(null, attempt));
          continue;
        }
        throw err;
      }

      const { data, raw } = await readBody(res);
      if (res.ok) return { ok: true, id: data?.id ?? null };

      const code = data?.name ?? "";
      const retryable =
        res.status === 429 || (idempotent && (res.status >= 500 || code === "concurrent_idempotent_requests"));
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(retryDelay(res, attempt));
        continue;
      }
      // Misma clave con otro contenido: ese mail ya salió en las últimas 24 h.
      if (res.status === 409 && code === "invalid_idempotent_request") {
        console.info(`[email] ${label} ya enviado (Idempotency-Key repetida): no se reenvía.`);
        return { ok: true, id: null };
      }
      // Sólo `name` y `message` del error (sin el cuerpo crudo) y sin emails completos.
      const error = maskEmails(data?.message || data?.name || `HTTP ${res.status}`);
      const detail = data ? [data.name, data.message].filter(Boolean).join(": ") : raw ? "respuesta no JSON" : "sin cuerpo";
      console.error(`[email] Resend rechazó ${label}: HTTP ${res.status} ${maskEmails(detail).replace(/\s+/g, " ").slice(0, 300)}`);
      return { ok: false, error };
    }
  } catch (err) {
    const error = maskEmails(err instanceof Error ? err.message : String(err));
    console.error(`[email] No se pudo enviar ${label}: ${error}`);
    return { ok: false, error };
  }
}

/** ¿El envío salió? (`skipped` no cuenta). */
export function wasSent(result: SendResult): boolean {
  return "ok" in result && result.ok;
}
