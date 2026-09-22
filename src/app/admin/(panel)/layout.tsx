import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { SIDEBAR_COOKIE } from "@/components/admin/nav";
import { PendingApproval } from "@/components/admin/PendingApproval";
import { getProfile, getSession, isAdminRole, ROLE_LABELS, type Role } from "@/lib/auth";
import { getSettings } from "@/lib/store/settings";

export const dynamic = "force-dynamic";

/**
 * Chequeo REAL de acceso al panel (el proxy sólo hace el redirect optimista):
 * sesión válida + perfil activo con rol owner/admin/staff. Cuentas
 * `pending` o desactivadas ven la pantalla de espera.
 */
export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await getSession();
  if (!user) redirect("/admin/login");

  const profile = await getProfile();
  if (!profile || !profile.is_active || !isAdminRole(profile.role)) {
    return <PendingApproval email={user.email ?? ""} inactive={Boolean(profile && profile.role !== "pending")} />;
  }

  const [cookieStore, storeName] = await Promise.all([
    cookies(),
    getSettings()
      .then((s) => s.name)
      .catch(() => "Ecommy"),
  ]);

  return (
    <AdminShell
      storeName={storeName}
      isOwner={profile.role === "owner"}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      user={{
        name: profile.name || user.email || "Usuario",
        email: profile.email,
        roleLabel: ROLE_LABELS[profile.role as Role],
      }}
    >
      {children}
    </AdminShell>
  );
}
