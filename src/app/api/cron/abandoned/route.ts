import { NextResponse, type NextRequest } from "next/server";

import { cronAuthorized } from "@/lib/cron-auth";
import { runAbandonedNotices } from "@/lib/email/abandoned-notices";

export const dynamic = "force-dynamic";
/** Los envíos se espacian (~2 por segundo en Resend): margen para una tanda grande. */
export const maxDuration = 300;

/**
 * Avisos de carrito abandonado cada 6 horas (Vercel Cron, ver vercel.json;
 * requiere un plan de Vercel que admita crons de más de una vez por día). Sin
 * este cron los avisos salen igual desde `/api/cron/daily`, una vez por día.
 * Mismo `Authorization: Bearer $CRON_SECRET` que el diario. Detalle en
 * src/lib/email/abandoned-notices.ts. Sin RESEND_API_KEY,
 * SUPABASE_SERVICE_ROLE_KEY o la migración 0020 responde `{ ok: true }` sin
 * mandar nada.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const emails = await runAbandonedNotices(new Date(), 240_000);
  return NextResponse.json({ ok: true, emails });
}
