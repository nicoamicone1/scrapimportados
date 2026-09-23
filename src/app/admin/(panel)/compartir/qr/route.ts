import type { NextRequest } from "next/server";
import QRCode from "qrcode";

import { requireAdmin } from "@/lib/auth";
import { storeUrl } from "@/lib/tenant/urls";

export const dynamic = "force-dynamic";

/** Sólo el link de la tienda o el de un producto/categoría suyo. */
const PATH_RE = /^\/(?:producto|categoria)\/[^/?#\s]{1,200}$/;

/**
 * GET /admin/compartir/qr[?path=/producto/<slug>]
 * PNG de 1024 px del QR del link público de la tienda activa, como descarga
 * (para imprimir en el mostrador, la bolsa o la tarjeta).
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return new Response("Iniciá sesión para descargar el QR.", { status: 401 });
  }
  const path = request.nextUrl.searchParams.get("path");
  const target = path && PATH_RE.test(path) ? path : "/";
  const url = storeUrl(ctx.store, target);
  const png = await QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
  const name = (target === "/" ? ctx.store.slug : `${ctx.store.slug}-${target.split("/").pop()}`).replace(/[^\w-]/g, "");
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${name}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
