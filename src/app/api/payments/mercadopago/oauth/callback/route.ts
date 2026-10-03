import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { logAudit } from "@/lib/audit";
import { getSession, type AdminContext } from "@/lib/auth";
import { MercadoPagoError } from "@/lib/billing/mercadopago";
import { tagFor } from "@/lib/cache-tags";
import { paymentsDb, saveConnectedAccount } from "@/lib/payments/accounts";
import { paymentsEnabled } from "@/lib/payments/config";
import { exchangeCode } from "@/lib/payments/oauth";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, openOAuthState } from "@/lib/payments/oauth-state";
import { platformUrl } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

function done(query: string) {
  const res = NextResponse.redirect(platformUrl(`/admin/configuracion/pagos?${query}`));
  res.cookies.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}

/**
 * Vuelta de Mercado Pago después de "Conectar". Valida la cookie cifrada
 * (state + PKCE + tienda + usuario), que la sesión sea del mismo usuario y que
 * siga siendo dueño de la tienda; canjea el code y guarda la cuenta cifrada.
 */
export async function GET(request: NextRequest) {
  if (!paymentsEnabled()) return done("mp=error&motivo=no_configurado");
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done("mp=error&motivo=cancelado");

  const saved = openOAuthState(request.cookies.get(OAUTH_COOKIE)?.value);
  const code = params.get("code");
  const state = params.get("state");
  if (!saved || !code || !state || state !== saved.state) return done("mp=error&motivo=vencido");

  const { supabase, user } = await getSession();
  if (!user || user.id !== saved.userId) return done("mp=error&motivo=sesion");
  const { data: isOwner } = await supabase.rpc("is_store_owner", { p_store_id: saved.storeId });
  if (!isOwner) return done("mp=error&motivo=solo_duenio");

  const db = paymentsDb();
  if (!db) return done("mp=error&motivo=no_configurado");

  try {
    const token = await exchangeCode(code, saved.verifier);
    await saveConnectedAccount(db, saved.storeId, user.id, token);
    revalidateTag(tagFor("payment-methods", saved.storeId), "max");
    revalidateTag(tagFor("products", saved.storeId), "max");
    await logAudit(
      { supabase, user, store: { id: saved.storeId } as AdminContext["store"] },
      {
        action: "payments.mercadopago_connected",
        entity: "settings",
        entityId: "payments",
        summary: `Conectó la cuenta de Mercado Pago #${token.user_id}${token.live_mode === false ? " (prueba)" : ""}`,
      },
    );
    return done("mp=conectado");
  } catch (err) {
    console.error("[payments] oauth callback:", err instanceof Error ? err.message : err);
    return done(`mp=error&motivo=${err instanceof MercadoPagoError ? "mercadopago" : "guardar"}`);
  }
}
