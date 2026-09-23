import { NextResponse, type NextRequest } from "next/server";

/** Compatibilidad: links de email viejos → `/auth/callback` (misma query). */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/callback";
  return NextResponse.redirect(url);
}
