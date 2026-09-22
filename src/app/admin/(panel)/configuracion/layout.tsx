import type { ReactNode } from "react";

import { NoPermission } from "@/components/admin/settings/NoPermission";
import { can } from "@/lib/admin/permissions";
import { getProfile } from "@/lib/auth";

/** Configuración: sólo owner y admin (staff ve "Sin permisos"). */
export default async function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  if (!can(profile, "settings.write")) {
    return <NoPermission title="Configuración" />;
  }
  return children;
}
