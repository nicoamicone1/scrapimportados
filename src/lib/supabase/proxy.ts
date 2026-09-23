import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Refresca la sesión de Supabase (rota tokens y reescribe cookies) y devuelve
 * la respuesta que arma `makeResponse` (un `next()` o un `rewrite()` con los
 * headers del tenant). `makeResponse` se vuelve a llamar si Supabase cambia
 * cookies, para que el request reescrito también las vea.
 *
 * `hasUser` es un chequeo OPTIMISTA (claims del JWT): el acceso real lo
 * validan `requireAdmin()` y los layouts.
 */
export async function refreshSession(
  request: NextRequest,
  makeResponse: () => NextResponse,
): Promise<{ response: NextResponse; hasUser: boolean }> {
  let response = makeResponse();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { response, hasUser: false };

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = makeResponse();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // IMPORTANTE: nada entre createServerClient y getClaims (ver docs de @supabase/ssr).
  const { data } = await supabase.auth.getClaims();
  return { response, hasUser: Boolean(data?.claims?.sub) };
}
