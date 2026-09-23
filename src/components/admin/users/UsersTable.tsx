"use client";

import { MoreHorizontal, Power, ShieldCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changeUserRole, removeMember, setUserActive } from "@/app/admin/(panel)/usuarios/actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { DropdownItem, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Input";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import type { ActionResult } from "@/lib/actions";
import type { AdminUser } from "@/lib/admin/users";
import { formatDate, formatDateTime, formatRelative } from "@/lib/dates";

const ROLE_BADGE: Record<AdminUser["role"], { label: string; tone: BadgeTone }> = {
  owner: { label: "Dueño", tone: "accent" },
  admin: { label: "Administrador", tone: "blue" },
  staff: { label: "Staff", tone: "neutral" },
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "staff", label: "Staff" },
  { value: "owner", label: "Dueño" },
];

type DialogState =
  | { kind: "role"; user: AdminUser }
  | { kind: "remove"; user: AdminUser }
  | { kind: "active"; user: AdminUser }
  | null;

export function UsersTable({ users, currentUserId, canManage }: { users: AdminUser[]; currentUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const team = users;

  const run = async (fn: () => Promise<ActionResult>, success: string) => {
    const res = await fn();
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  };

  return (
    <div className="space-y-6">
      <Table>
        <THead>
          <tr>
            <TH>Usuario</TH>
            <TH>Rol</TH>
            <TH>Estado</TH>
            <TH>Último acceso</TH>
            <TH>Alta</TH>
            {canManage ? (
              <TH className="w-12">
                <span className="sr-only">Acciones</span>
              </TH>
            ) : null}
          </tr>
        </THead>
        <TBody>
          {team.length === 0 ? (
            <TableEmpty colSpan={canManage ? 6 : 5} title="Todavía no hay nadie en el equipo" />
          ) : (
            team.map((u) => {
              const isMe = u.id === currentUserId;
              const role = ROLE_BADGE[u.role];
              return (
                <TR key={u.id}>
                  <TD>
                    <div className="font-medium">
                      {u.name || u.email.split("@")[0]}
                      {isMe ? <span className="ml-1.5 text-xs font-normal text-adm-fg-muted">(vos)</span> : null}
                    </div>
                    <div className="text-xs text-adm-fg-muted">{u.email}</div>
                  </TD>
                  <TD>
                    <Badge tone={role.tone}>{role.label}</Badge>
                  </TD>
                  <TD>{u.is_active ? <Badge tone="green">Activo</Badge> : <Badge tone="neutral">Desactivado</Badge>}</TD>
                  <TD muted>
                    {u.last_access_at ? (
                      <time suppressHydrationWarning dateTime={u.last_access_at} title={formatDateTime(u.last_access_at)}>
                        {formatRelative(u.last_access_at)}
                      </time>
                    ) : (
                      "Nunca"
                    )}
                  </TD>
                  <TD muted>
                    <time suppressHydrationWarning dateTime={u.created_at}>{formatDate(u.created_at)}</time>
                  </TD>
                  {canManage ? (
                    <TD>
                      <DropdownMenu
                        width={220}
                        trigger={
                          <button
                            type="button"
                            aria-label={`Acciones para ${u.email}`}
                            className="inline-flex size-7 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </button>
                        }
                      >
                        <DropdownItem icon={<ShieldCheck />} disabled={isMe} onSelect={() => setDialog({ kind: "role", user: u })}>
                          Cambiar rol
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem icon={<Power />} danger={u.is_active} disabled={isMe} onSelect={() => setDialog({ kind: "active", user: u })}>
                          {u.is_active ? "Desactivar" : "Reactivar"}
                        </DropdownItem>
                        <DropdownItem icon={<UserMinus />} danger disabled={isMe} onSelect={() => setDialog({ kind: "remove", user: u })}>
                          Quitar del equipo
                        </DropdownItem>
                      </DropdownMenu>
                    </TD>
                  ) : null}
                </TR>
              );
            })
          )}
        </TBody>
      </Table>

      <ConfirmDialog
        open={dialog?.kind === "remove"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "remove" ? `¿Quitar a ${dialog.user.email} del equipo?` : ""}
        description="Deja de ver esta tienda en su panel. Su cuenta de Ecommy sigue existiendo y lo que hizo queda en la auditoría."
        confirmLabel="Quitar del equipo"
        destructive
        onConfirm={async () => {
          if (dialog?.kind !== "remove") return;
          await run(() => removeMember({ id: dialog.user.id }), "Lo quitamos del equipo.");
        }}
      />
      {dialog?.kind === "role" ? (
        <RoleDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onSave={(role) => run(() => changeUserRole({ id: dialog.user.id, role }), "Rol actualizado.")}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === "active"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog?.kind === "active" ? (dialog.user.is_active ? `¿Desactivar a ${dialog.user.email}?` : `¿Reactivar a ${dialog.user.email}?`) : ""}
        description={
          dialog?.kind === "active" && dialog.user.is_active
            ? "No va a poder entrar al panel de esta tienda hasta que lo reactives. Lo que hizo queda registrado."
            : "Vuelve a entrar al panel de esta tienda con el mismo rol que tenía."
        }
        confirmLabel={dialog?.kind === "active" && dialog.user.is_active ? "Desactivar usuario" : "Reactivar usuario"}
        destructive={dialog?.kind === "active" && dialog.user.is_active}
        onConfirm={async () => {
          if (dialog?.kind !== "active") return;
          const next = !dialog.user.is_active;
          await run(() => setUserActive({ id: dialog.user.id, active: next }), next ? "Usuario reactivado." : "Usuario desactivado.");
        }}
      />
    </div>
  );
}

function RoleDialog({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: (role: string) => Promise<boolean> }) {
  const [role, setRole] = useState<string>(user.role);
  const [pending, startTransition] = useTransition();
  const hints: Record<string, string> = {
    owner: "Control total, incluido el equipo. Puede haber más de un dueño.",
    admin: "Todo menos invitar gente y cambiar roles.",
    staff: "Opera el día a día: pedidos, productos, stock y contenido. No entra a Configuración, Usuarios ni Auditoría ni cambia precios en masa.",
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Cambiar rol"
      description={user.email}
      dismissable={!pending}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={role === user.role}
            onClick={() =>
              startTransition(async () => {
                if (await onSave(role)) onClose();
              })
            }
          >
            Guardar rol
          </Button>
        </>
      }
    >
      <Field label="Rol" hint={hints[role]}>
        <Select value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_OPTIONS} />
      </Field>
    </Dialog>
  );
}
