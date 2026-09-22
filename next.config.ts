import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
