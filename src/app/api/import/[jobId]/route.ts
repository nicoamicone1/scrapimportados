import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, withAdmin } from "@/lib/scraper/api";
import { getJob } from "@/lib/scraper/queries";

export const dynamic = "force-dynamic";

/** Estado del job (para el polling del detalle). */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return jsonError("Importación inexistente.", 404);
  return withAdmin(async (ctx) => {
    const job = await getJob(ctx, jobId);
    if (!job) return jsonError("Importación inexistente.", 404);
    return NextResponse.json({ ok: true as const, job });
  });
}
