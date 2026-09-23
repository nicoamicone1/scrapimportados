import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { Toaster } from "@/components/ui/Toaster";

import "../admin/admin.css";

export const metadata: Metadata = {
  title: { default: "Ecommy · Tu tienda online con tu marca", template: "%s · Ecommy" },
  description:
    "Creá tu tienda online en minutos: catálogo con variantes, precios masivos, envíos por zona y cobro por transferencia o WhatsApp. 14 días de Pro gratis.",
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
    </div>
  );
}
