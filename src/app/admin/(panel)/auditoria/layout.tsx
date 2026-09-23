import type { ReactNode } from "react";

import { NoPermission } from "@/components/admin/settings/NoPermission";
import { can } from "@/lib/admin/permissions";
import { requireAdmin } from "@/lib/auth";

/** Auditoría de la tienda activa: sólo owner y admin. */
export default async function AuditoriaLayout({ children }: { children: ReactNode }) {
  const ctx = await requireAdmin();
  if (!can(ctx.membership, "audit.read")) {
    return <NoPermission title="Auditoría" />;
  }
  return children;
}
