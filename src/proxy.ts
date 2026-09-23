import { NextResponse, type NextRequest } from "next/server";

import { refreshSession } from "@/lib/supabase/proxy";
import { lookupStoreSlugByDomain } from "@/lib/tenant/domain-lookup";
import { classifyHost, parseStorePath } from "@/lib/tenant/host";
import { fallbackBase, platformUrl, ROOT_DOMAIN } from "@/lib/tenant/urls";

/*
 * Resolución de tienda (spec §14.2, ver "Estructura de rutas" ahí):
 *
 * - Host de plataforma (ROOT_DOMAIN, www, localhost, *.vercel.app):
 *     /, /planes, /login, /registro, /auth/*, /invitacion/*, /app/*, /admin/*,
 *     /platform/*  → rutas reales (src/app/(platform)/*, src/app/admin/*).
 *     /s/<slug>/…  → storefront en modo fallback (ruta real src/app/s/[store]/*):
 *                    sólo se fijan los headers del tenant.
 * - Host de tienda (<slug>.ROOT_DOMAIN o dominio propio verificado):
 *     /…           → REWRITE a /s/<slug>/… (la URL pública no cambia).
 *     /admin/*     → redirect al admin de la plataforma.
 *
 * Headers para el server (los que manda el cliente se descartan):
 *   x-site: platform|store · x-store-slug · x-store-base ("" o "/s/<slug>")
 *
 * Además refresca la sesión de Supabase y hace el redirect OPTIMISTA de
 * /admin, /app y /platform sin sesión a /login?next=… (el chequeo real lo
 * hacen requireAdmin()/los layouts).
 */

const PROTECTED_PREFIXES = ["/admin", "/app", "/platform"];
/** Rutas de /admin que quedan públicas (redirects de compatibilidad y dev-login). */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/setup", "/admin/auth"];

function startsWithSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function needsSession(pathname: string) {
  if (PUBLIC_ADMIN_PATHS.some((p) => startsWithSegment(pathname, p))) return false;
  return PROTECTED_PREFIXES.some((p) => startsWithSegment(pathname, p));
}

function tenantHeaders(request: NextRequest, tenant: { slug: string; base: string } | null): Headers {
  const headers = new Headers(request.headers);
  headers.delete("x-site");
  headers.delete("x-store-slug");
  headers.delete("x-store-base");
  if (tenant) {
    headers.set("x-site", "store");
    headers.set("x-store-slug", tenant.slug);
    headers.set("x-store-base", tenant.base);
  } else {
    headers.set("x-site", "platform");
  }
  return headers;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = classifyHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"), ROOT_DOMAIN);

  // ---------- Host de tienda (subdominio o dominio propio) ----------
  let storeSlug: string | null = null;
  if (host.kind === "store") storeSlug = host.slug;
  if (host.kind === "custom") {
    storeSlug = await lookupStoreSlugByDomain(host.domain);
    if (!storeSlug) {
      return new NextResponse("Esta tienda no existe.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  }

  if (storeSlug) {
    if (startsWithSegment(pathname, "/admin")) {
      const target = platformUrl(`${pathname}${search}`);
      return NextResponse.redirect(target.startsWith("http") ? target : new URL(target, request.url));
    }
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname === "/" ? fallbackBase(storeSlug) : `${fallbackBase(storeSlug)}${pathname}`;
    const tenant = { slug: storeSlug, base: "" };
    const { response } = await refreshSession(request, () =>
      NextResponse.rewrite(rewriteUrl, { request: { headers: tenantHeaders(request, tenant) } }),
    );
    return response;
  }

  // ---------- Host de plataforma ----------
  const fallback = parseStorePath(pathname);
  const tenant = fallback ? { slug: fallback.slug, base: fallbackBase(fallback.slug) } : null;
  const { response, hasUser } = await refreshSession(request, () =>
    NextResponse.next({ request: { headers: tenantHeaders(request, tenant) } }),
  );

  if (!tenant && !hasUser && needsSession(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Conserva cookies que se hayan limpiado/rotado en este request.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo excepto: /api, assets de Next (_next/static, _next/image),
     * favicon y archivos estáticos por extensión. robots.txt y sitemap.xml
     * SÍ pasan (dependen de la tienda).
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff2?)$).*)",
  ],
};
