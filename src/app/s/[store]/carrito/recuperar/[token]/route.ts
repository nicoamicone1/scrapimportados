import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { recoverCookiePath } from "@/lib/store/checkout-reminders";
import { isSessionToken, RECOVER_COOKIE, RECOVER_COOKIE_MAX_AGE, UNSUBSCRIBE_COOKIE } from "@/lib/store/checkout-sessions";
import { TENANT_HEADERS } from "@/lib/tenant/resolve";
import { STORE_SLUG_RE } from "@/lib/tenant/slug";
import { fallbackBase } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

/**
 * Links del mail de carrito abandonado (migración 0020):
 *   /carrito/recuperar/<token>         → reponer el carrito;
 *   /carrito/recuperar/<token>?baja=1  → confirmar la baja de los avisos.
 *
 * Guarda el token en una cookie httpOnly de 10 minutos (`ecommy_recover` o
 * `ecommy_unsub`, sólo para `/carrito` de esta tienda) y redirige (303) a
 * `/carrito`, que la lee en el server. Así el token no queda en la barra, ni
 * en el historial, ni en el `page_location` que mandan GA4, GTM o Meta Pixel.
 * Esta respuesta sale con `Referrer-Policy: no-referrer` (acá y en
 * next.config.ts). Un token inválido redirige igual, sin cookie: `/carrito`
 * muestra el carrito de siempre.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/s/[store]/carrito/recuperar/[token]">) {
  const { store, token: raw } = await ctx.params;
  if (!STORE_SLUG_RE.test(store)) return new NextResponse("Esta tienda no existe.", { status: 404 });
  const token = raw.trim().toLowerCase();
  const unsubscribe = request.nextUrl.searchParams.get("baja") === "1";
  // Prefijo real del request ("" en subdominio o dominio propio, "/s/<slug>" en la plataforma).
  const header = (await headers()).get(TENANT_HEADERS.base);
  const safeBase = header === "" || header === fallbackBase(store) ? header : fallbackBase(store);

  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: `${safeBase}/carrito`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  if (isSessionToken(token)) {
    const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    res.cookies.set(unsubscribe ? UNSUBSCRIBE_COOKIE : RECOVER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: https,
      path: recoverCookiePath(safeBase),
      maxAge: RECOVER_COOKIE_MAX_AGE,
    });
  }
  return res;
}
