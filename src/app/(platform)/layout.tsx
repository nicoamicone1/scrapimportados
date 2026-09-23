import type { Metadata } from "next";
import type { ReactNode } from "react";

import { googleSiteVerification } from "@/components/platform/analytics";
import { PlatformAnalytics } from "@/components/platform/PlatformAnalytics";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { Toaster } from "@/components/ui/Toaster";
import { APP_NAME } from "@/lib/version";

import "../admin/admin.css";

export const metadata: Metadata = {
  title: { default: "Ecommy · Tu tienda online con tu marca", template: "%s · Ecommy" },
  description:
    "Creá tu tienda online en minutos: catálogo con variantes, precios masivos, envíos por zona y cobro por transferencia o WhatsApp. 14 días de Pro gratis.",
  // La imagen sale de `opengraph-image.tsx` (en esta carpeta, no en la raíz:
  // un `openGraph` definido acá reemplaza entero al de la raíz, imagen
  // incluida). Twitter/X toma la misma imagen.
  openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website" },
  twitter: { card: "summary_large_image" },
  // Search Console: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (sólo el token).
  verification: googleSiteVerification() ? { google: googleSiteVerification() } : undefined,
};

/**
 * Sitio de la plataforma (host raíz): landing, planes, registro, login,
 * mis tiendas, alta de tienda e invitaciones. Usa los tokens del admin
 * (`.admin-root`, src/app/admin/admin.css): es el mismo producto.
 */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-root">
      <NavigationProgress />
      {children}
      <Toaster />
      <PlatformAnalytics />
    </div>
  );
}
