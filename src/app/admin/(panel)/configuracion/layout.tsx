import type { ReactNode } from "react";

import { NoPermission } from "@/components/admin/settings/NoPermission";
import { can } from "@/lib/admin/permissions";
import { requireAdmin } from "@/lib/auth";

/** Configuración de la tienda activa: sólo owner y admin (staff ve "Sin permisos"). */
export default async function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const ctx = await requireAdmin();
  if (!can(ctx.membership, "settings.write")) {
    return <NoPermission title="Configuración" />;
  }
  return children;
}
