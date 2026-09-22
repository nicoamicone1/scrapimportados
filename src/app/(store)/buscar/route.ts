import { NextResponse, type NextRequest } from "next/server";

import { searchSuggestions } from "@/lib/store/products";
import { getSettings } from "@/lib/store/settings";

/**
 * JSON liviano para el buscador del header: `/buscar?q=taladro` → hasta 8
 * sugerencias (nombre, SKU, marca, precio, imagen) + total. Sale del índice
 * cacheado del catálogo (tag `products`).
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [], total: 0 });
  const settings = await getSettings();
  const result = await searchSuggestions(q, 8, settings.catalog.out_of_stock_display);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "X-Robots-Tag": "noindex",
    },
  });
}
