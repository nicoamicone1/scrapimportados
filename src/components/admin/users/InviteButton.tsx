"use client";

import { Copy, Link2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { inviteMember, revokeInvite, type InviteResult } from "@/app/admin/(panel)/usuarios/actions";
import { PlanGate } from "@/components/admin/PlanGate";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import type { StoreInvite } from "@/lib/admin/users";
import { formatRelative } from "@/lib/dates";

const ROLE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Administrador" },
];

function inviteLink(token: string) {
  return `${window.location.origin}/invitacion/${token}`;
}

async function copy(text: string, ok = "Link copiado.") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("No se pudo copiar. Seleccioná el link y copialo a mano.");
  }
}

/**
 * "Invitar": si el email ya tiene cuenta en Ecommy se suma al equipo al
 * instante; si no, se genera un link de invitación para mandarle a mano
 * (en esta versión la plataforma todavía no envía emails).
 */
export function InviteButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setEmail("");
    setRole("staff");
    setError(null);
    setResult(null);
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await inviteMember({ email, role });
      if (!res.ok) {
        setError(res.fieldErrors?.email?.[0] ?? res.error);
        return;
      }
      setResult(res.data);
      router.refresh();
      if (res.data.status === "added") toast.success(`${res.data.email} ya es parte del equipo.`);
    });

  return (
    <>
      <PlanGate feature="team.members" mode="inline" label="Invitar">
        <Button variant="primary" icon={<UserPlus />} onClick={() => setOpen(true)} disabled={disabled}>
          Invitar
        </Button>
      </PlanGate>
      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title="Sumar a alguien al equipo"
        description="Si ya tiene cuenta en Ecommy entra directo; si no, le armamos un link para que se registre."
        dismissable={!pending}
        footer={
          result ? (
            <Button variant="primary" onClick={close}>
              Listo
            </Button>
          ) : (
            <>
              <Button onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={submit} loading={pending} loadingText="Invitando…" disabled={!email.trim()}>
                Invitar
              </Button>
            </>
          )
        }
      >
        {result?.status === "invited" ? (
          <div className="space-y-3 text-sm">
            <p>
              Todavía no hay una cuenta con <span className="font-medium">{result.email}</span>. Mandale este link (vence en 7 días): al
              abrirlo se registra con ese email y queda en el equipo.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink(result.token)} onFocus={(e) => e.currentTarget.select()} aria-label="Link de invitación" />
              <Button icon={<Copy />} onClick={() => copy(inviteLink(result.token))}>
                Copiar
              </Button>
            </div>
          </div>
        ) : result?.status === "added" ? (
          <p className="text-sm">
            <span className="font-medium">{result.email}</span> ya tenía cuenta: lo sumamos al equipo. La próxima vez que entre va a ver esta
            tienda en su selector.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label="Email" error={error ?? undefined}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="off" placeholder="nombre@correo.com" />
            </Field>
            <Field
              label="Rol"
              hint={role === "admin" ? "Todo menos invitar gente y cambiar roles." : "Pedidos, productos, stock y contenido. Sin configuración ni precios en masa."}
            >
              <Select value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_OPTIONS} />
            </Field>
          </form>
        )}
      </Dialog>
    </>
  );
}

/** Invitaciones pendientes (sólo las ve el dueño). */
export function InvitesCard({ invites }: { invites: StoreInvite[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!invites.length) return null;

  const revoke = async (id: string) => {
    setBusy(id);
    const res = await revokeInvite({ id });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Invitación anulada.");
    router.refresh();
  };

  return (
    <Card className="mb-6">
      <CardHeader title="Invitaciones pendientes" description="Todavía no se registraron. Podés volver a copiar el link o anularla." />
      <ul className="divide-y divide-adm-border">
        {invites.map((i) => {
          const expired = i.expired;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.email}</div>
                <div className="text-xs text-adm-fg-muted">
                  {i.role === "admin" ? "Administrador" : "Staff"} · {expired ? "vencida" : `vence ${formatRelative(i.expires_at)}`}
                </div>
              </div>
              {!expired ? (
                <Button size="sm" icon={<Link2 />} onClick={() => copy(inviteLink(i.token))}>
                  Copiar link
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" icon={<Trash2 />} loading={busy === i.id} onClick={() => revoke(i.id)}>
                Anular
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
