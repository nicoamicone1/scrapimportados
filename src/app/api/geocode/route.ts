import type { NextRequest } from "next/server";

import { AdminError, requireAdmin } from "@/lib/auth";
import { reverseGeocode, searchPlaces } from "@/lib/shipping/geocode";

/**
 * Proxy de Nominatim para el admin (buscador del mapa de zonas y del punto
 * de retiro). Sólo admins: el User-Agent y el rate limit se manejan en el
 * server (src/lib/shipping/geocode.ts).
 *
 *   GET /api/geocode?q=Palermo, CABA       → { results: GeocodeResult[] }
 *   GET /api/geocode?lat=-34.6&lng=-58.4   → { results: [GeocodeResult] | [] }
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AdminError) return Response.json({ error: err.message }, { status: 401 });
    throw err;
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  if (q) {
    if (q.length > 200) return Response.json({ error: "La búsqueda es demasiado larga." }, { status: 400 });
    const limit = Number(params.get("limit")) || 5;
    const results = await searchPlaces(q, limit);
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  }

  if (params.has("lat") && params.has("lng")) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return Response.json({ error: "Coordenadas inválidas." }, { status: 400 });
    }
    const result = await reverseGeocode(lat, lng);
    return Response.json({ results: result ? [result] : [] }, { headers: { "Cache-Control": "private, max-age=300" } });
  }

  return Response.json({ error: "Pasá ?q= o ?lat=&lng=." }, { status: 400 });
}
