"use client";

import { usePathname } from "next/navigation";

import { TabsNav } from "@/components/ui/Tabs";

const BASE = "/admin/taller-3d";

/** Secciones del Taller 3D (docs/modules/TALLER-3D.md §1.3). */
export const PRINT3D_TABS: { label: string; href: string; exact?: boolean }[] = [
  { label: "Resumen", href: BASE, exact: true },
  { label: "Cola", href: `${BASE}/cola` },
  { label: "Cotizaciones", href: `${BASE}/cotizaciones` },
  { label: "Impresoras", href: `${BASE}/impresoras` },
  { label: "Filamento", href: `${BASE}/filamento` },
  { label: "Productos", href: `${BASE}/productos` },
  { label: "Configuración", href: `${BASE}/configuracion` },
];

function isActive(tab: { href: string; exact?: boolean }, pathname: string): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/** Pestañas-link del Taller 3D (subrayado 2px, DESIGN.md §7.4). */
export function ModuleTabs({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  return (
    <TabsNav
      label="Secciones del Taller 3D"
      className={className}
      items={PRINT3D_TABS.map((t) => ({ href: t.href, label: t.label, active: isActive(t, pathname) }))}
    />
  );
}
