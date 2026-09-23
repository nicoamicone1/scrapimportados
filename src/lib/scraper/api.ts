import "server-only";

import { NextResponse } from "next/server";

import { AdminError, requireAdmin, type AdminContext } from "@/lib/auth";
import { PlanError } from "@/lib/plans";

import { ScrapeError } from "./http";

/** Respuesta de error estándar de los route handlers del importador. */
export function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false as const, error }, { status });
}

/**
 * Envuelve un route handler: exige admin, convierte `AdminError` en 401/403,
 * `PlanError` en 403 con `code: "plan"`, `ScrapeError` en 422 con su mensaje
 * y el resto en 500 genérico.
 */
export async function withAdmin(fn: (ctx: AdminContext) => Promise<Response>): Promise<Response> {
  try {
    const ctx = await requireAdmin();
    return await fn(ctx);
  } catch (err) {
    if (err instanceof AdminError) return jsonError(err.message, err.code === "unauthorized" ? 401 : 403);
    if (err instanceof PlanError) return NextResponse.json({ ok: false as const, error: err.message, code: "plan" as const }, { status: 403 });
    if (err instanceof ScrapeError) return jsonError(err.message, 422);
    console.error("[api/import]", err);
    return jsonError("Algo salió mal. Probá de nuevo.", 500);
  }
}
