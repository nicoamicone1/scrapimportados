/**
 * URLs de tienda y de plataforma (isomórfico: server y client).
 *
 * Modos (spec §14.2):
 * - Subdominio: la tienda vive en `https://<slug>.<ROOT_DOMAIN>/…` y sus
 *   links son paths "pelados" (`/productos`).
 * - Fallback (`isFallbackMode()`): el ROOT_DOMAIN no admite subdominios
 *   wildcard (localhost, *.vercel.app): la tienda vive en
 *   `<origen>/s/<slug>/…` y los links internos llevan ese prefijo.
 *
 * El prefijo real de un request lo decide el proxy (header `x-store-base`):
 * una tienda con subdominio también se puede ver por `/s/<slug>`. Por eso
 * los componentes usan `storePath(path, basePath)` con el `basePath` del
 * tenant (server: `getTenant()`, client: `useStorePath()`), y `storeUrl()`
 * sólo para URLs absolutas que salen de la app (WhatsApp, remitos, "Ver tienda").
 */

import { hostnameOf, isDevOrPreviewHost } from "./host";

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

/** `true` cuando el dominio raíz no permite subdominios por tienda. */
export function isFallbackMode(rootDomain: string = ROOT_DOMAIN): boolean {
  const mode = process.env.NEXT_PUBLIC_TENANT_MODE;
  if (mode === "path") return true;
  if (mode === "subdomain") return false;
  return isDevOrPreviewHost(hostnameOf(rootDomain));
}

function protocolFor(host: string): "http" | "https" {
  const h = hostnameOf(host);
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost") ? "http" : "https";
}

/** Origen absoluto de la plataforma (sin barra final). */
export function platformOrigin(rootDomain: string = ROOT_DOMAIN): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site && isFallbackMode(rootDomain)) return site.replace(/\/+$/, "");
  return `${protocolFor(rootDomain)}://${rootDomain}`;
}

/**
 * URL de una página de la plataforma. En modo fallback la plataforma y las
 * tiendas comparten host, así que alcanza con el path relativo.
 */
export function platformUrl(path = "/", rootDomain: string = ROOT_DOMAIN): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return isFallbackMode(rootDomain) ? p : `${platformOrigin(rootDomain)}${p}`;
}

/** Links que no se tocan: absolutos, protocolos, anclas y queries sueltas. */
function isExternal(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(href);
}

/**
 * Antepone el prefijo de la tienda (`/s/<slug>` en fallback, "" en
 * subdominio) a un path interno. Idempotente.
 *
 *   storePath("/productos", "/s/demo")       → "/s/demo/productos"
 *   storePath("/", "/s/demo")                → "/s/demo"
 *   storePath("/#como-comprar", "/s/demo")   → "/s/demo#como-comprar"
 *   storePath("https://x.com", "/s/demo")    → "https://x.com"
 */
export function storePath(path: string, basePath = ""): string {
  if (!basePath || !path || isExternal(path)) return path;
  const href = path.startsWith("/") ? path : `/${path}`;
  if (href === basePath || href.startsWith(`${basePath}/`) || href.startsWith(`${basePath}?`) || href.startsWith(`${basePath}#`)) {
    return href;
  }
  if (href === "/") return basePath;
  if (href.startsWith("/?") || href.startsWith("/#")) return `${basePath}${href.slice(1)}`;
  return `${basePath}${href}`;
}

/** Quita el prefijo de la tienda de un path (inverso de `storePath`). */
export function stripStoreBase(path: string, basePath = ""): string {
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(`${basePath}/`)) return path.slice(basePath.length);
  return path;
}

/** Prefijo de links de una tienda cuando se navega por la plataforma (fallback). */
export function fallbackBase(slug: string): string {
  return `/s/${slug}`;
}

export interface StoreUrlTarget {
  slug: string;
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
}

/**
 * URL pública absoluta de una tienda (+ path opcional) según el modo:
 * dominio propio verificado > subdominio > `/s/<slug>` en la plataforma.
 */
export function storeUrl(store: StoreUrlTarget, path = "/", rootDomain: string = ROOT_DOMAIN): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (store.custom_domain && store.custom_domain_verified) {
    return `https://${store.custom_domain}${p === "/" ? "" : p}`;
  }
  if (isFallbackMode(rootDomain)) {
    return `${platformOrigin(rootDomain)}${storePath(p, fallbackBase(store.slug))}`;
  }
  return `${protocolFor(rootDomain)}://${store.slug}.${rootDomain}${p === "/" ? "" : p}`;
}

/**
 * Href de "Ver tienda" desde la plataforma/admin: relativo en fallback (mismo
 * host, conserva la sesión), absoluto en subdominio.
 */
export function storeHref(store: StoreUrlTarget, path = "/", rootDomain: string = ROOT_DOMAIN): string {
  if (isFallbackMode(rootDomain) && !(store.custom_domain && store.custom_domain_verified)) {
    return storePath(path, fallbackBase(store.slug));
  }
  return storeUrl(store, path, rootDomain);
}

/** Dirección "linda" para mostrar (sin protocolo): `taller-luna.ecommy.app`. */
export function storeDisplayHost(store: StoreUrlTarget, rootDomain: string = ROOT_DOMAIN): string {
  return storeUrl(store, "/", rootDomain).replace(/^https?:\/\//, "");
}
