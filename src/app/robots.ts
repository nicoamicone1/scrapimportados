import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/store/seo";
import { getSettings } from "@/lib/store/settings";

export const dynamic = "force-dynamic";

/** /robots.txt (P0-01): bloquea admin, API, carrito, checkout, pedidos y búsqueda; todo si hay mantenimiento. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  let maintenance = false;
  try {
    maintenance = (await getSettings()).maintenance.enabled;
  } catch {
    // Sin DB: robots permisivo con los bloqueos de siempre.
  }
  if (maintenance) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/carrito", "/checkout", "/pedido/", "/buscar"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
