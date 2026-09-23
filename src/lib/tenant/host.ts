/**
 * Clasificación del host de un request (spec §14.2). Pura: la usan el proxy
 * (`src/proxy.ts`), `getTenant()` y los tests.
 *
 *   platform  → ROOT_DOMAIN o www.ROOT_DOMAIN: landing, registro, /app, /admin, /platform.
 *   store     → <slug>.ROOT_DOMAIN: storefront de esa tienda.
 *   custom    → cualquier otro dominio: puede ser el dominio propio de una tienda.
 *   fallback  → hosts de desarrollo/preview que no son el ROOT_DOMAIN
 *               (localhost, 127.0.0.1, *.vercel.app): se comportan como la
 *               plataforma y el storefront se sirve en `/s/<slug>/…`.
 */

import { RESERVED_STORE_SLUGS, STORE_SLUG_RE } from "./slug";

export type HostKind =
  | { kind: "platform" }
  | { kind: "fallback" }
  | { kind: "store"; slug: string }
  | { kind: "custom"; domain: string };

/** Hostname en minúsculas, sin puerto ni punto final. */
export function hostnameOf(host: string | null | undefined): string {
  if (!host) return "";
  let h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    // IPv6 con puerto: [::1]:3000
    const end = h.indexOf("]");
    return end > 0 ? h.slice(0, end + 1) : h;
  }
  const colon = h.indexOf(":");
  if (colon >= 0) h = h.slice(0, colon);
  return h.replace(/\.$/, "");
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** Hosts de desarrollo/preview que nunca son un dominio propio de tienda. */
export function isDevOrPreviewHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".vercel.app");
}

export function classifyHost(host: string | null | undefined, rootDomain: string): HostKind {
  const hostname = hostnameOf(host);
  const root = hostnameOf(rootDomain);
  if (!hostname) return { kind: "fallback" };

  if (root && (hostname === root || hostname === `www.${root}`)) return { kind: "platform" };

  if (root && hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(root.length + 1));
    if (sub && !sub.includes(".") && STORE_SLUG_RE.test(sub) && !RESERVED_STORE_SLUGS.includes(sub)) {
      return { kind: "store", slug: sub };
    }
    // demo.<root> es la tienda demo: reservada para altas, pero existe.
    if (sub === "demo") return { kind: "store", slug: sub };
    return { kind: "platform" };
  }

  // <slug>.localhost (Chrome resuelve *.localhost a loopback) → tienda en dev.
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    if (sub && !sub.includes(".") && STORE_SLUG_RE.test(sub)) return { kind: "store", slug: sub };
    return { kind: "fallback" };
  }

  if (isDevOrPreviewHost(hostname)) return { kind: "fallback" };
  return { kind: "custom", domain: hostname };
}

/**
 * Path `/s/<slug>/…` del modo fallback → `{ slug, rest }` (rest empieza con
 * "/"). `null` si el path no es de ese formato.
 */
export function parseStorePath(pathname: string): { slug: string; rest: string } | null {
  const m = /^\/s\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).toLowerCase();
  if (!STORE_SLUG_RE.test(slug)) return null;
  return { slug, rest: m[2] ?? "/" };
}
