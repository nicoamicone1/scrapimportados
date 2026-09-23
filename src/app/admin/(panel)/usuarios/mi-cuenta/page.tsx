import type { Metadata } from "next";

import { MyAccount } from "@/components/admin/users/MyAccount";
import { PageHeader } from "@/components/ui/display";
import { can } from "@/lib/admin/permissions";
import { requireAdmin, ROLE_LABELS } from "@/lib/auth";

export const metadata: Metadata = { title: "Mi cuenta" };

/** Disponible para todos los roles (incluido staff). */
export default async function MiCuentaPage() {
  const { profile, user, membership, store } = await requireAdmin();
  return (
    <>
      <PageHeader
        title="Mi cuenta"
        description={`${profile.email} · ${ROLE_LABELS[membership.role]} en ${store.name}`}
        breadcrumb={can(membership, "users.read") ? [{ label: "Usuarios", href: "/admin/usuarios" }, { label: "Mi cuenta" }] : undefined}
      />
      <MyAccount name={profile.name ?? ""} email={profile.email} lastSignIn={user.last_sign_in_at ?? null} />
    </>
  );
}
