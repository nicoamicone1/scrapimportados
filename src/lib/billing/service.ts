import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";

/*
 * Cliente con `SUPABASE_SERVICE_ROLE_KEY` para el cobro. `billing_apply_subscription`
 * sólo la puede ejecutar service_role, así que lo usan ÚNICAMENTE:
 *   - el webhook /api/billing/mercadopago/webhook (firma de MP validada), y
 *   - la sincronización con MP después de una acción ya autorizada (dueño que
 *     cancela la renovación, superadmin que fuerza la sincronización).
 * En los tres casos lo que se escribe sale de la API de MercadoPago, nunca
 * del usuario. Sin la clave, devuelve null y el cobro automático no aplica nada.
 */

export type BillingDb = SupabaseClient<Database>;

let warned = false;

export function billingServiceClient(): BillingDb | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !SUPABASE_URL) {
    if (!warned) {
      warned = true;
      console.info("[billing] SUPABASE_SERVICE_ROLE_KEY no está configurada: los avisos de MercadoPago no se aplican.");
    }
    return null;
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
