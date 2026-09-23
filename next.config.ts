import type { NextConfig } from "next";

/*
 * Cabeceras de seguridad. Si dos reglas ponen la misma cabecera, gana la
 * ÚLTIMA (docs de `headers`): primero van los valores generales y después
 * los específicos. `source` es la ruta PEDIDA (antes del rewrite del proxy):
 * en un host de tienda el storefront llega como `/…` y en la plataforma como
 * `/s/<slug>/…`.
 *
 * No es una CSP completa (sin `default-src`): el storefront carga GA4, GTM,
 * Meta Pixel, Google Fonts e imágenes de terceros configurados por cada tienda.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), usb=(), payment=(), geolocation=(self)" },
  // Storefront (y todo lo demás): sólo se puede embeber desde el mismo origen.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

/**
 * Panel, cuenta y login: nunca en un iframe (clickjacking) y los formularios
 * sólo envían al mismo origen. Los logins son server actions (mismo origen) y
 * el callback de Supabase es una navegación, no un form.
 */
const APP_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

/**
 * Estado del pedido y link del mail de carrito abandonado
 * (`/carrito/recuperar/<token>`): la URL lleva un token de acceso, no se manda
 * como Referer.
 */
const ORDER_HEADERS = [{ key: "Referrer-Policy", value: "no-referrer" }];

/**
 * Íconos e imágenes para compartir generados (`icon.tsx`, `apple-icon.tsx`,
 * `opengraph-image.tsx`): Next los sirve con `max-age=0, must-revalidate` y
 * cada visita los vuelve a pedir. El HTML los enlaza con `?<hash>` del
 * contenido (si cambian, cambia la URL), así que un día de caché más una
 * semana de `stale-while-revalidate` es seguro. `/icon` es el mismo en todos
 * los hosts: el favicon propio de una tienda tiene su URL (`s/[store]/layout.tsx`).
 */
const GENERATED_IMAGE_HEADERS = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/:area(admin|app|platform|login|registro|auth)/:path*", headers: APP_HEADERS },
      // Plataforma (`/s/<slug>/pedido/…`) y host de tienda (`/pedido/…`).
      { source: "/s/:store/pedido/:path*", headers: ORDER_HEADERS },
      { source: "/pedido/:path*", headers: ORDER_HEADERS },
      { source: "/s/:store/carrito/recuperar/:path*", headers: ORDER_HEADERS },
      { source: "/carrito/recuperar/:path*", headers: ORDER_HEADERS },
      { source: "/:image(icon|apple-icon)", headers: GENERATED_IMAGE_HEADERS },
      { source: "/:path*/:image(opengraph-image-[^/]+)", headers: GENERATED_IMAGE_HEADERS },
    ];
  },
  // Cada agente/entorno puede usar su propio build dir (ej. NEXT_DIST_DIR=.next-f).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "dazimportadora.com.ar" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: {
      // Subida de imágenes desde el admin.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
