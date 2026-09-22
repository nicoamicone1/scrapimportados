import { NextResponse } from "next/server";

import { importSelectedItems } from "@/app/admin/(panel)/importar/actions";
import { jsonError } from "@/lib/scraper/api";

export const dynamic = "force-dynamic";

/** Fase "review": POST { itemIds?: string[], all?: boolean } → pasa a "apply". */
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Datos inválidos.");
  const b = body as { itemIds?: unknown; all?: unknown };
  const r = await importSelectedItems({
    jobId,
    itemIds: Array.isArray(b.itemIds) ? b.itemIds.map(String) : [],
    all: b.all === true,
  });
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
