import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const SAFE_PREFIXES = ["/admin", "/app", "/platform", "/invitacion", "/auth/reset"];

/**
 * Callback de Supabase Auth (confirmación de email, recuperación de
 * contraseña con PKCE): canjea `?code=` por una sesión y redirige a `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/app";
  const next =
    !nextParam.startsWith("//") && SAFE_PREFIXES.some((p) => nextParam === p || nextParam.startsWith(`${p}/`) || nextParam.startsWith(`${p}?`))
      ? nextParam
      : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth] callback:", error.message);
  }
  return NextResponse.redirect(new URL("/login?error=link", origin));
}
