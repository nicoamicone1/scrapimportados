import { UserRound } from "lucide-react";
import type { Metadata } from "next";

import { NoPermission } from "@/components/admin/settings/NoPermission";
import { LimitBanner } from "@/components/admin/LimitBanner";
import { InviteButton, InvitesCard } from "@/components/admin/users/InviteButton";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { can } from "@/lib/admin/permissions";
import { listInvites, listUsers } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Usuarios" };

const MATRIX: { label: string; owner: boolean; admin: boolean; staff: boolean }[] = [
  { label: "Pedidos, clientes y pagos", owner: true, admin: true, staff: true },
  { label: "Productos, categorías e inventario", owner: true, admin: true, staff: true },
  { label: "Promociones y cupones", owner: true, admin: true, staff: true },
  { label: "Apariencia, páginas, menús y envíos", owner: true, admin: true, staff: true },
  { label: "Cambios masivos de precios", owner: true, admin: true, staff: false },
  { label: "Configuración y exportaciones", owner: true, admin: true, staff: false },
  { label: "Auditoría y lista de usuarios", owner: true, admin: true, staff: false },
  { label: "Invitar gente, cambiar roles y quitar del equipo", owner: true, admin: false, staff: false },
];

function Yes({ on }: { on: boolean }) {
  return <span className={on ? "text-adm-fg" : "text-adm-fg-muted"}>{on ? "Sí" : "No"}</span>;
}

export default async function UsuariosPage() {
  const ctx = await requireAdmin();
  if (!can(ctx.membership, "users.read")) {
    return (
      <NoPermission
        title="Usuarios"
        description="Sólo el dueño y los administradores ven el equipo. Podés cambiar tu nombre y tu contraseña en Mi cuenta."
      />
    );
  }
  const canManage = can(ctx.membership, "users.manage");
  const [users, invites] = await Promise.all([listUsers(ctx), canManage ? listInvites(ctx) : Promise.resolve([])]);
  const active = users.filter((u) => u.is_active).length;
  const pendingInvites = invites.filter((i) => !i.expired).length;

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={`${active} ${active === 1 ? "persona activa" : "personas activas"} en ${ctx.store.name}${pendingInvites ? ` · ${pendingInvites} ${pendingInvites === 1 ? "invitación pendiente" : "invitaciones pendientes"}` : ""}`}
        actions={
          <>
            <ButtonLink href="/admin/usuarios/mi-cuenta" icon={<UserRound />}>
              Mi cuenta
            </ButtonLink>
            {canManage ? <InviteButton /> : null}
          </>
        }
      />
      {!canManage ? (
        <p className="mb-4 text-[13px] text-adm-fg-muted">Sólo el dueño de la tienda puede invitar gente, cambiar roles o desactivar cuentas.</p>
      ) : null}
      {canManage ? <LimitBanner limit="staff" used={active + pendingInvites} className="mb-4" /> : null}
      <InvitesCard invites={invites} />

      <UsersTable users={users} currentUserId={ctx.user.id} canManage={canManage} />

      <Card className="mt-6 max-w-3xl">
        <CardHeader title="Qué puede hacer cada rol" description="Los roles son por tienda: la misma persona puede ser dueña de una y staff de otra. Invitar y cambiar roles además está protegido en la base de datos." />
        <CardBody className="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-adm-border text-left text-xs text-adm-fg-muted">
                <th className="px-4 py-2 font-medium">Puede…</th>
                <th className="w-20 px-2 py-2 font-medium">Dueño</th>
                <th className="w-24 px-2 py-2 font-medium">Administrador</th>
                <th className="w-20 px-2 py-2 font-medium">Staff</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r) => (
                <tr key={r.label} className="border-b border-adm-border last:border-b-0">
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-2 py-2">
                    <Yes on={r.owner} />
                  </td>
                  <td className="px-2 py-2">
                    <Yes on={r.admin} />
                  </td>
                  <td className="px-2 py-2">
                    <Yes on={r.staff} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
