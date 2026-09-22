import type { ReactNode } from "react";

import { NoPermission } from "@/components/admin/settings/NoPermission";
import { can } from "@/lib/admin/permissions";
import { getProfile } from "@/lib/auth";

/** Auditoría: sólo owner y admin. */
export default async function AuditoriaLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  if (!can(profile, "audit.read")) {
    return <NoPermission title="Auditoría" />;
  }
  return children;
}
