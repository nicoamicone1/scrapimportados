import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sitio 100% estático: `next build` genera la carpeta `out/`.
  output: "export",
  // Sin servidor de optimización de imágenes (las fotos vienen del proveedor).
  images: {
    unoptimized: true,
  },
  // `/producto/foo` -> `out/producto/foo/index.html` (mejor para hostings estáticos).
  trailingSlash: true,
};

export default nextConfig;
