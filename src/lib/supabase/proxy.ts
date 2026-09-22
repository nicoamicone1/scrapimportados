import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Rutas del admin que no requieren sesión. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/setup", "/admin/auth"];

function isPublicAdminPath(pathname: string) {
  return PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refresca la sesión de Supabase (rota tokens y reescribe cookies) y hace el
 * redirect OPTIMISTA de /admin/* a /admin/login. El chequeo real de rol lo
 * hace el layout `(panel)` con `getProfile()`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // IMPORTANTE: nada entre createServerClient y getClaims (ver docs de @supabase/ssr).
  const { data } = await supabase.auth.getClaims();
  const hasUser = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/admin") && !isPublicAdminPath(pathname) && !hasUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(url);
    // Conserva cookies que se hayan limpiado/rotado en este request.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
