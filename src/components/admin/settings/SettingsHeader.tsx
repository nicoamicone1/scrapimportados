import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/display";

/** Encabezado de una subpágina de Configuración (breadcrumb + acciones). */
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
  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      breadcrumb={[{ label: "Configuración", href: "/admin/configuracion" }, ...(parent ? [parent] : []), { label: title }]}
    >
      {children}
    </PageHeader>
  );
}
