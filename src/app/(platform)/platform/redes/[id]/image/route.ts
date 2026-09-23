import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import { loadSocialFonts, renderRedSlide } from "@/app/_brand/social-templates";
import {
  FORMAT_SIZE,
  fillSlide,
  fillValuesFrom,
  getRedPiece,
  pendingTokens,
  redFileName,
  slideTexts,
  type RedFormat,
} from "@/content/redes";
import { getProfile, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
/** Node: la fuente se lee con `fs` (ver `loadSocialFonts`). */
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store" };

function notFound() {
  return new Response("No existe.", { status: 404, headers: NO_STORE });
}

/**
 * GET /platform/redes/<id>/image?format=feed|story[&placa=2][&download=1][&<campo>=valor]
 * PNG de una placa del kit de redes (1080 × 1080 o 1080 × 1920). Sólo para
 * superadmins: sin sesión, 401; sin permiso, 404 (como las páginas de
 * /platform, no revela que existe). Los campos "completar" (`tiempo`,
 * `cantidad`…) reemplazan su token en la placa; si falta alguno, la placa
 * sale con la banda "Completar antes de publicar".
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/platform/redes/[id]/image">) {
  const { user } = await getSession();
  if (!user) return new Response("Iniciá sesión.", { status: 401, headers: NO_STORE });
  const profile = await getProfile();
  if (!profile?.is_platform_admin) return notFound();

  const { id } = await ctx.params;
  const piece = getRedPiece(id);
  if (!piece) return notFound();

  const params = request.nextUrl.searchParams;
  const format = (params.get("format") ?? piece.formats[0]) as RedFormat;
  if (!piece.formats.includes(format)) return notFound();
  const index = Number(params.get("placa") ?? "1");
  if (!Number.isInteger(index) || index < 1 || index > piece.slides.length) return notFound();

  const values = fillValuesFrom(piece, (key) => params.get(key));
  const slide = fillSlide(piece, piece.slides[index - 1], values);
  const element = renderRedSlide(slide, {
    format,
    index,
    total: piece.kind === "carrusel" ? piece.slides.length : 1,
    pending: pendingTokens(slideTexts(slide)),
  });

  const headers: Record<string, string> = { ...NO_STORE };
  if (params.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="${redFileName(piece, index, format)}"`;
  }
  return new ImageResponse(element, { ...FORMAT_SIZE[format], fonts: await loadSocialFonts(), headers });
}
