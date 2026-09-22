import { NextResponse } from "next/server";

import { createImportJob, resyncImportJob } from "@/app/admin/(panel)/importar/actions";
import { jsonError } from "@/lib/scraper/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * API JSON equivalente al formulario (sirve para automatizar re-syncs):
 *   POST { url, adapter?, options }  → crea un job
 *   POST { resyncOf: jobId }         → re-sincroniza un job terminado
 * Las actions ya exigen admin y validan con zod.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Datos inválidos.");
  const r =
    "resyncOf" in body && typeof body.resyncOf === "string"
      ? await resyncImportJob(body.resyncOf)
      : await createImportJob(body as Parameters<typeof createImportJob>[0]);
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true as const, jobId: r.data.jobId });
}
