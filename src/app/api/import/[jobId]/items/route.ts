import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, withAdmin } from "@/lib/scraper/api";
import { getJob, listItems } from "@/lib/scraper/queries";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  estado: z.enum(["all", "pending", "imported", "updated", "skipped", "error"]).catch("all"),
  q: z.string().max(100).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  per: z.coerce.number().int().min(10).max(500).catch(50),
});

/** Ítems del job con filtro por estado, búsqueda y paginación (resueltos en el server). */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return jsonError("Importación inexistente.", 404);
  const sp = new URL(request.url).searchParams;
  const f = querySchema.parse({
    estado: sp.get("estado") ?? undefined,
    q: sp.get("q") ?? undefined,
    page: sp.get("page") ?? undefined,
    per: sp.get("per") ?? undefined,
  });
  return withAdmin(async (ctx) => {
    const job = await getJob(ctx.supabase, jobId);
    if (!job) return jsonError("Importación inexistente.", 404);
    const data = await listItems(ctx.supabase, jobId, {
      status: f.estado,
      q: f.q,
      page: f.page,
      perPage: f.per,
      options: job.options,
    });
    return NextResponse.json({ ok: true as const, ...data, page: f.page, perPage: f.per });
  });
}
