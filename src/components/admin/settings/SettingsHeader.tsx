"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";

/** Subpáginas de Configuración, en el orden en que se suelen completar. */
const SECTIONS = [
  { href: "/admin/configuracion/tienda", label: "Tienda" },
  { href: "/admin/configuracion/pagos", label: "Pagos y checkout" },
  { href: "/admin/configuracion/legales", label: "Impuestos y legales" },
  { href: "/admin/configuracion/seo", label: "SEO e integraciones" },
  { href: "/admin/configuracion/exportar", label: "Exportar" },
];

/**
 * Encabezado de una subpágina de Configuración: breadcrumb, acciones y pestañas
 * entre las secciones (para saltar de Pagos a Legales sin volver al índice).
 */
export function SettingsHeader({
  title,
  description,
  actions,
  children,
  parent,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Nivel intermedio del breadcrumb (ej. SEO en Redirecciones). */
  parent?: { label: string; href: string };
}) {
  const pathname = usePathname();
  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      breadcrumb={[{ label: "Configuración", href: "/admin/configuracion" }, ...(parent ? [parent] : []), { label: title }]}
    >
      <TabsNav
        label="Secciones de configuración"
        items={SECTIONS.map((s) => ({ ...s, active: pathname === s.href || pathname.startsWith(`${s.href}/`) }))}
      />
      {children}
    </PageHeader>
  );
}
