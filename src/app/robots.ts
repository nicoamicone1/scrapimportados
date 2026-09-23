import type { MetadataRoute } from "next";

import { platformOrigin } from "@/lib/tenant/urls";

/**
 * robots.txt de la PLATAFORMA (ROOT_DOMAIN / modo fallback). Cada tienda en
 * subdominio o dominio propio tiene el suyo (`s/[store]/robots.txt`, vía el
 * rewrite del proxy). En modo fallback las tiendas cuelgan de `/s/<slug>`,
 * así que acá también se bloquean sus paths privados.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/planes", "/s/"],
        disallow: [
          "/admin",
          "/app",
          "/platform",
          "/auth",
          "/api",
          "/s/*/carrito",
          "/s/*/checkout",
          "/s/*/pedido/",
          "/s/*/buscar",
        ],
      },
    ],
    sitemap: `${platformOrigin()}/sitemap.xml`,
  };
}
