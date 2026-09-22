import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, withAdmin } from "@/lib/scraper/api";
import { JobNotFoundError, runJobStep } from "@/lib/scraper/engine";

export const dynamic = "force-dynamic";
/** Cada paso trabaja ~40 s y guarda el cursor; el cliente llama en loop. */
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return jsonError("Importación inexistente.", 404);
  return withAdmin(async (ctx) => {
    try {
      const step = await runJobStep(ctx, jobId);
      return NextResponse.json({ ok: true as const, ...step });
    } catch (err) {
      if (err instanceof JobNotFoundError) return jsonError("Importación inexistente.", 404);
      throw err;
    }
  });
}
