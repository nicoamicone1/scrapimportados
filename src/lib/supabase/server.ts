import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { assertSupabaseEnv, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la sesión del usuario (cookies) → todo corre bajo RLS como ese usuario.
 * Crear uno nuevo por request (no reutilizar entre requests).
 */
export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: no se pueden escribir cookies.
          // El proxy (src/proxy.ts) ya refresca la sesión en cada request.
        }
      },
    },
  });
}

/**
 * Cliente anónimo SIN cookies, para lecturas públicas cacheadas del
 * storefront (`unstable_cache` no permite leer cookies adentro).
 * Ve exactamente lo que ve un visitante (RLS de `anon`).
 */
export function createPublicClient() {
  assertSupabaseEnv();
  return createPlainClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
