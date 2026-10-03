import { NextResponse } from "next/server";

import { AdminError, requireAdmin } from "@/lib/auth";
import { paymentsEnabled } from "@/lib/payments/config";
import { authorizationUrl, newPkce, newState } from "@/lib/payments/oauth";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, OAUTH_TTL_S, sealOAuthState } from "@/lib/payments/oauth-state";
import { platformUrl } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

const back = (motivo: string) => platformUrl(`/admin/configuracion/pagos?mp=error&motivo=${motivo}`);

/**
 * "Conectar Mercado Pago" (docs/PAYMENTS.md §4). Sólo el dueño de la tienda
 * activa, con su propia sesión (un superadmin "entrando como" no conecta
 * cuentas ajenas). Guarda state + PKCE en una cookie cifrada y redirige a MP.
 */
export async function GET() {
  if (!paymentsEnabled()) return NextResponse.redirect(back("no_configurado"));
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.redirect(platformUrl("/admin/login?next=/admin/configuracion/pagos"));
    throw err;
  }
  if (ctx.membership.role !== "owner" || ctx.membership.impersonating) return NextResponse.redirect(back("solo_duenio"));

  const { verifier, challenge } = newPkce();
  const state = newState();
  const res = NextResponse.redirect(authorizationUrl(state, challenge));
  res.cookies.set(OAUTH_COOKIE, sealOAuthState({ state, verifier, storeId: ctx.store.id, userId: ctx.user.id, exp: Date.now() + OAUTH_TTL_S * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_TTL_S,
  });
  return res;
}
