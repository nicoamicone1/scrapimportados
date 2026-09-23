import { NextResponse } from "next/server";

import { assertFeature } from "@/lib/plans";
import { withAdmin, jsonError } from "@/lib/scraper/api";
import { detectSource } from "@/lib/scraper/detect";
import { detectInputSchema } from "@/lib/schemas/import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { url, adapter? } → { adapter, total, categories, sample[3] } */
export async function POST(request: Request) {
  return withAdmin(async (ctx) => {
    assertFeature(ctx, "catalog.import_web");
    const body: unknown = await request.json().catch(() => null);
    const parsed = detectInputSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    const result = await detectSource(parsed.data.url, parsed.data.adapter);
    return NextResponse.json({ ok: true as const, url: parsed.data.url, ...result });
  });
}
