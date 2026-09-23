import { NextResponse, type NextRequest } from "next/server";

import { isMissingSchemaError, isSessionToken, readSessionRpc, recoverPath } from "@/lib/store/checkout-sessions";
import { createPublicClient } from "@/lib/supabase/server";
import { storeUrl } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

/**
 * Baja en un clic del encabezado `List-Unsubscribe` del mail de carrito
 * abandonado (RFC 8058, migración 0020): `/api/email/unsubscribe?token=<token>`.
 *
 * - POST (Gmail, Apple Mail, Outlook: "Desuscribirse"): da de baja SIN
 *   confirmación y responde 200. Los antivirus de correo abren links (GET)
 *   pero no hacen POST, así que no hay bajas accidentales.
 * - GET (un cliente que abre la URL en el navegador): redirige a la
 *   confirmación con botón de la tienda (`/carrito/recuperar/<token>?baja=1`),
 *   la misma del link del pie del mail.
 *
 * La baja vale para el email de la sesión en esa tienda (lista de supresión
 * `checkout_unsubscribes`). Un token inexistente responde igual: el token
 * tiene 192 bits, no hay nada que adivinar.
 */

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function tokenOf(request: NextRequest): string | null {
  const token = request.nextUrl.searchParams.get("token")?.trim().toLowerCase() ?? "";
  return isSessionToken(token) ? token : null;
}

export async function POST(request: NextRequest) {
  const token = tokenOf(request);
  if (token) {
    try {
      const { error } = await createPublicClient().rpc("checkout_session_unsubscribe", { p_token: token });
      if (error) {
        if (!isMissingSchemaError(error)) console.error("[carritos] baja en un clic:", error.code, error.message);
        // Error de la base: el cliente de correo puede reintentar.
        if (!isMissingSchemaError(error)) return new NextResponse("No pudimos darte de baja. Probá de nuevo en un rato.", { status: 503, headers: NO_STORE });
      }
    } catch (err) {
      console.error("[carritos] baja en un clic:", err instanceof Error ? err.message : err);
      return new NextResponse("No pudimos darte de baja. Probá de nuevo en un rato.", { status: 503, headers: NO_STORE });
    }
  }
  return new NextResponse("Listo: no te vamos a volver a escribir por carritos sin terminar de esta tienda.", {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const token = tokenOf(request);
  if (token) {
    try {
      const db = createPublicClient();
      const { data } = await db.rpc("get_checkout_session", { p_token: token });
      const session = readSessionRpc(data);
      if (session) {
        const { data: store } = await db
          .from("stores")
          .select("slug, custom_domain, custom_domain_verified")
          .eq("id", session.storeId)
          .maybeSingle();
        if (store) {
          return new NextResponse(null, { status: 303, headers: { ...NO_STORE, Location: storeUrl(store, recoverPath(token, true)) } });
        }
      }
    } catch (err) {
      console.error("[carritos] baja (GET):", err instanceof Error ? err.message : err);
    }
  }
  return new NextResponse("Este link ya no sirve. Si te sigue llegando algún aviso, respondé ese mail.", {
    status: 404,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  });
}
