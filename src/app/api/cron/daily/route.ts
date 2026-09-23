import { NextResponse, type NextRequest } from "next/server";

import { collectTrialNotices, deliverTrialNotices } from "@/lib/email/trial-notices";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Barrido diario (Vercel Cron, ver vercel.json): vence trials (→ Free) y
 * cancela pedidos impagos vencidos de TODAS las tiendas, devolviendo stock.
 * Protegido con `Authorization: Bearer $CRON_SECRET` (Vercel lo manda solo).
 * Corre como anon: `run_daily_maintenance()` es security definer y sólo
 * aplica reglas que ya correspondían (no recibe parámetros).
 *
 * Emails de fin de prueba (src/lib/email/trial-notices.ts): se juntan ANTES
 * del mantenimiento (que borra `trial_ends_at` de las vencidas) y se mandan
 * después. Sin RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY no hacen nada.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const trialNotices = await collectTrialNotices();
  const { data, error } = await createPublicClient().rpc("run_daily_maintenance");
  if (error) {
    console.error("[cron] daily:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const emails = await deliverTrialNotices(trialNotices);
  return NextResponse.json({ ok: true, result: data, emails });
}
