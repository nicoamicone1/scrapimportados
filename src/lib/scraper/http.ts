/**
 * HTTP del importador: UA de navegador, rate limit por host (600 ms),
 * reintentos con backoff, timeout y bloqueo de destinos internos (SSRF).
 * Sólo se usa del lado del server.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const RATE_LIMIT_MS = 600;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1000;
const TIMEOUT_MS = 20_000;

/** Error "de negocio" del scraper: su mensaje se muestra al admin tal cual. */
export class ScrapeError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ScrapeError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --------------------------------------------------------------- SSRF guard

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (low.startsWith("fe80") || low.startsWith("fc") || low.startsWith("fd")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return false;
  }
  return true;
}

const checkedHosts = new Map<string, boolean>();

/** Valida que la URL sea http(s) y apunte a internet público. Lanza `ScrapeError` si no. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ScrapeError("La URL no es válida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ScrapeError("La URL tiene que empezar con http:// o https://.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ScrapeError("No se puede importar desde direcciones internas.");
  }
  const cached = checkedHosts.get(host);
  if (cached === true) return url;
  if (cached === false) throw new ScrapeError("No se puede importar desde direcciones internas.");

  let ok: boolean;
  if (isIP(host)) {
    ok = !isPrivateIp(host);
  } else {
    try {
      const addrs = await lookup(host, { all: true });
      ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
    } catch {
      throw new ScrapeError(`No encontramos el sitio ${host}. Revisá la dirección.`);
    }
  }
  checkedHosts.set(host, ok);
  if (!ok) throw new ScrapeError("No se puede importar desde direcciones internas.");
  return url;
}

// --------------------------------------------------------------- rate limit

const lastHit = new Map<string, number>();

async function throttle(host: string, interval: number) {
  const last = lastHit.get(host) ?? 0;
  const wait = last + interval - Date.now();
  lastHit.set(host, Math.max(Date.now(), last + interval));
  if (wait > 0) await sleep(wait);
}

// --------------------------------------------------------------- fetch

export interface FetchOptions {
  accept?: string;
  /** Reintentos (default 3 intentos en total). */
  attempts?: number;
  /** Tamaño máximo de la respuesta en bytes (default 15 MB). */
  maxBytes?: number;
  /** No lanzar en 404 (devuelve la respuesta). */
  allow404?: boolean;
  /** Intervalo mínimo entre requests al mismo host (default 600 ms). */
  rateLimitMs?: number;
}

function looksLikeChallenge(res: Response, body: string): boolean {
  if (res.headers.get("cf-mitigated")) return true;
  const server = res.headers.get("server") ?? "";
  return (
    (res.status === 403 || res.status === 503 || res.status === 429) &&
    (/cloudflare/i.test(server) || /just a moment|cf-chl|challenge-platform|attention required/i.test(body))
  );
}

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > maxBytes) throw new ScrapeError("La respuesta es demasiado grande.");
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new ScrapeError("La respuesta es demasiado grande.");
  return buf;
}

/**
 * GET con UA de navegador, throttle por host, timeout y reintentos
 * (red, 429 y 5xx). Devuelve la respuesta y el cuerpo en bytes.
 */
export async function fetchRaw(
  rawUrl: string,
  opts: FetchOptions = {},
): Promise<{ res: Response; body: Uint8Array; url: string }> {
  const url = await assertPublicUrl(rawUrl);
  const attempts = opts.attempts ?? MAX_ATTEMPTS;
  const maxBytes = opts.maxBytes ?? 15 * 1024 * 1024;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    await throttle(url.host, opts.rateLimitMs ?? RATE_LIMIT_MS);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept ?? "application/json, text/html;q=0.9, */*;q=0.8",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        },
      });
      // Si hubo redirect a otro host, revalidamos el destino final.
      if (res.url && res.url !== url.toString()) await assertPublicUrl(res.url);

      if (res.ok || (opts.allow404 && res.status === 404)) {
        const body = await readLimited(res, maxBytes);
        return { res, body, url: res.url || url.toString() };
      }
      const text = new TextDecoder().decode(await readLimited(res, 2 * 1024 * 1024));
      if (looksLikeChallenge(res, text)) {
        throw new ScrapeError(
          "El sitio bloquea el acceso automático (Cloudflare u otro antibot). No se puede importar desde acá.",
          null, // null = no se reintenta
        );
      }
      const retryable = res.status === 429 || res.status >= 500;
      const err = new ScrapeError(`El sitio respondió ${res.status} en ${url.pathname}.`, res.status);
      if (!retryable) throw err;
      lastErr = err;
      if (attempt < attempts) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 10_000)
          : BACKOFF_BASE_MS * 2 ** (attempt - 1);
        await sleep(wait);
      }
    } catch (err) {
      if (err instanceof ScrapeError && (err.status === null || (err.status !== 429 && err.status < 500))) throw err;
      lastErr = err;
      if (attempt < attempts) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
    }
  }
  if (lastErr instanceof ScrapeError) throw lastErr;
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new ScrapeError(`No pudimos conectarnos a ${url.host} (${reason}).`);
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<{ text: string; res: Response; url: string }> {
  const { res, body, url: finalUrl } = await fetchRaw(url, { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", ...opts });
  return { text: new TextDecoder("utf-8").decode(body), res, url: finalUrl };
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<{ data: T; res: Response }> {
  const { res, body } = await fetchRaw(url, { accept: "application/json", ...opts });
  const text = new TextDecoder("utf-8").decode(body);
  try {
    return { data: JSON.parse(text) as T, res };
  } catch {
    throw new ScrapeError("La respuesta no es JSON válido.", res.status);
  }
}
