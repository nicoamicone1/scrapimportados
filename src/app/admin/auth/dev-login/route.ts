import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Login de DESARROLLO: inicia sesión con las credenciales de
 * `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` (variables de entorno, nunca del
 * request) y redirige al admin. Sólo existe fuera de producción; en
 * producción responde 404. Sirve para QA automatizado sin tipear contraseñas.
 */
export async function GET(request: NextRequest) {
  const email = process.env.DEV_LOGIN_EMAIL;
  const password = process.env.DEV_LOGIN_PASSWORD;
  if (process.env.NODE_ENV === "production" || !email || !password) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/admin";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return new NextResponse(`dev-login: ${error.message}`, { status: 401 });
  }
  return NextResponse.redirect(new URL(next, origin));
}
