"use client";

import { ArrowRightLeft, Copy, Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelStoreTransfer, transferStore, type TransferStoreResult } from "@/app/admin/(panel)/usuarios/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { debitBlocksTransfer, transferPreview, trialAfterTransfer } from "@/lib/admin/transfer";
import type { AdminUser, TransferPanel } from "@/lib/admin/users";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative } from "@/lib/dates";

const ROLE_LABELS: Record<AdminUser["role"], string> = { owner: "Dueño", admin: "Administrador", staff: "Staff" };

function transferLink(token: string) {
  return `${window.location.origin}/invitacion/tienda/${token}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado.");
  } catch {
    toast.error("No se pudo copiar. Seleccioná el link y copialo a mano.");
  }
}

/**
 * "Pasar la tienda a otra persona" (Usuarios, sólo el titular o el
 * superadmin). Caso típico: una tienda armada para un comercio que, si le
 * gusta, la sigue con su cuenta sin rehacerla.
 */
export function TransferStoreCard({
  storeName,
  panel,
  users,
}: {
  storeName: string;
  panel: TransferPanel;
  users: AdminUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const titular = users.find((u) => u.id === panel.titularId) ?? null;

  if (!panel.canTransfer) {
    return titular ? (
      <p className="mt-6 max-w-3xl text-[13px] text-adm-fg-muted">
        {storeName} está a nombre de {titular.email}. Sólo esa persona puede pasar la tienda a otra.
      </p>
    ) : null;
  }

  const blocked = debitBlocksTransfer(panel.subscription);
  const pending = panel.pending;

  const cancel = async () => {
    setCancelling(true);
    const res = await cancelStoreTransfer();
    setCancelling(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Link anulado: la tienda sigue como estaba.");
    router.refresh();
  };

  return (
    <Card className="mt-6 max-w-3xl">
      <CardHeader
        title="Pasar la tienda a otra persona"
        description={`${storeName} queda a su nombre con todo lo cargado: productos, páginas, estilo y pedidos. Si ya está en el equipo pasa al instante; si no, le mandamos un link.`}
        actions={
          <Button icon={<ArrowRightLeft />} onClick={() => setOpen(true)} disabled={blocked}>
            Pasar la tienda
          </Button>
        }
      />
      {blocked ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-adm-border px-4 py-3 text-[13px]">
          <p className="min-w-0 flex-1 text-adm-fg-muted">
            El plan se paga con débito automático de Mercado Pago a nombre de quien lo paga hoy. Cancelá la renovación y después pasá la tienda: el
            plan sigue hasta el fin del período.
          </p>
          <ButtonLink href="/admin/plan" size="sm">
            Ir a Plan
          </ButtonLink>
        </div>
      ) : null}
      {pending ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-adm-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Link para {pending.email}</div>
            <div className="text-xs text-adm-fg-muted">
              {pending.expired ? (
                "Venció sin que lo acepte. La tienda sigue a tu nombre."
              ) : (
                <>
                  Hasta que lo acepte, la tienda sigue como está · vence{" "}
                  <time suppressHydrationWarning dateTime={pending.expires_at}>
                    {formatRelative(pending.expires_at)}
                  </time>
                </>
              )}
            </div>
          </div>
          {!pending.expired ? (
            <Button size="sm" icon={<Link2 />} onClick={() => copy(transferLink(pending.token))}>
              Copiar link
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" icon={<Trash2 />} loading={cancelling} onClick={cancel}>
            Anular
          </Button>
        </div>
      ) : null}
      {open ? (
        <TransferDialog storeName={storeName} panel={panel} users={users} titular={titular} onClose={() => setOpen(false)} />
      ) : null}
    </Card>
  );
}

function TransferDialog({
  storeName,
  panel,
  users,
  titular,
  onClose,
}: {
  storeName: string;
  panel: TransferPanel;
  users: AdminUser[];
  titular: AdminUser | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TransferStoreResult | null>(null);
  const [pending, startTransition] = useTransition();

  const normalized = email.trim().toLowerCase();
  const member = users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  const candidates = users.filter((u) => u.id !== panel.titularId);
  const preview = useMemo(
    () =>
      transferPreview(
        {
          storeName,
          email: normalized,
          isMember: Boolean(member),
          keepPrevious,
          actorIsTitular: panel.actorIsTitular,
          titularEmail: titular?.email ?? null,
          trialEndsAt: trialAfterTransfer(panel.subscription, { alreadyTransferred: panel.alreadyTransferred }),
          mpSalesConnected: panel.mpSalesConnected,
          others: users
            .filter((u) => u.id !== panel.titularId && u.id !== member?.id && u.is_active)
            .map((u) => `${u.email} (${ROLE_LABELS[u.role]})`),
        },
        formatDate,
      ),
    [storeName, normalized, member, keepPrevious, panel, titular, users],
  );
  const selfTarget = Boolean(member && member.id === panel.titularId);
  const me = panel.actorIsTitular;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await transferStore({ email, keepPrevious });
      if (!res.ok) {
        setError(res.fieldErrors?.email?.[0] ?? res.error);
        return;
      }
      setResult(res.data);
      if (res.data.status === "transferred") {
        toast.success(`${storeName} ya está a nombre de ${res.data.email}.`);
        if (!res.data.leftTeam) router.refresh();
      } else {
        router.refresh();
      }
    });

  const done = () => {
    if (result?.status === "transferred" && result.leftTeam) {
      router.push("/app");
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && (result ? done() : onClose())}
      title={result ? (result.status === "pending" ? "Link listo para mandar" : "Tienda pasada") : `Pasar ${storeName} a otra persona`}
      description={result ? undefined : "Revisá qué pasa antes de confirmar."}
      dismissable={!pending}
      footer={
        result ? (
          <Button variant="primary" onClick={done}>
            {result.status === "transferred" && result.leftTeam ? "Ir a mis tiendas" : "Listo"}
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={submit} loading={pending} loadingText="Pasando…" disabled={!normalized || selfTarget}>
              {preview.confirmLabel}
            </Button>
          </>
        )
      }
    >
      {result?.status === "pending" ? (
        <div className="space-y-3 text-sm">
          <p>
            Le mandamos un mail a <span className="font-medium">{result.email}</span> con este link (vence el {formatDate(result.expiresAt)}). Si
            no le llega, copialo y mandáselo por WhatsApp. Al aceptarlo, la tienda queda a su nombre.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={transferLink(result.token)} onFocus={(e) => e.currentTarget.select()} aria-label="Link para recibir la tienda" />
            <Button icon={<Copy />} onClick={() => copy(transferLink(result.token))}>
              Copiar
            </Button>
          </div>
        </div>
      ) : result?.status === "transferred" ? (
        <div className="space-y-2 text-sm">
          <p>
            {storeName} ya está a nombre de <span className="font-medium">{result.email}</span>. Le avisamos por mail.
          </p>
          {result.trialEndsAt ? <p className="text-adm-fg-muted">Tiene Pro gratis hasta el {formatDate(result.trialEndsAt)}.</p> : null}
          {result.leftTeam ? <p className="text-adm-fg-muted">Saliste del equipo: la tienda ya no aparece en tu panel.</p> : null}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (normalized && !selfTarget) submit();
          }}
        >
          <Field
            label="Email de quien la recibe"
            error={error ?? (selfTarget ? "Esa persona ya tiene la tienda a su nombre." : undefined)}
            hint={member ? `Ya está en el equipo como ${ROLE_LABELS[member.role]}: pasa al instante.` : "Si no está en el equipo, le mandamos un link para aceptarla."}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="nombre@correo.com"
              list={candidates.length ? "transfer-team" : undefined}
            />
          </Field>
          {candidates.length ? (
            <datalist id="transfer-team">
              {candidates.map((u) => (
                <option key={u.id} value={u.email} />
              ))}
            </datalist>
          ) : null}

          {titular || me ? (
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-[13px] font-medium text-adm-fg">
                {me ? "Y vos" : `Y ${titular?.email ?? "el dueño anterior"}`}
              </legend>
              {[
                { value: true, label: me ? "Sigo como administrador" : "Sigue como administrador", hint: "Ve y trabaja la tienda; no invita gente ni cambia roles." },
                { value: false, label: me ? "Salgo del equipo" : "Sale del equipo", hint: "Deja de ver la tienda en el panel." },
              ].map((o) => (
                <label
                  key={String(o.value)}
                  className={cn(
                    "flex cursor-pointer gap-2.5 rounded-adm border p-3 text-sm",
                    keepPrevious === o.value ? "border-adm-accent bg-adm-accent-soft" : "border-adm-border hover:bg-adm-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="keep-previous"
                    checked={keepPrevious === o.value}
                    onChange={() => setKeepPrevious(o.value)}
                    className="mt-0.5 accent-[var(--adm-accent)]"
                  />
                  <span>
                    <span className="block font-medium text-adm-fg">{o.label}</span>
                    <span className="block text-xs text-adm-fg-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {normalized && !selfTarget ? (
            <div className="rounded-adm border border-adm-border bg-adm-surface-2 p-3">
              <p className="text-[13px] font-medium text-adm-fg">Qué pasa al confirmar</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] text-adm-fg-muted">
                {preview.consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!me ? (
            <p className="text-xs text-adm-fg-muted">Estás operando la tienda como administrador de la plataforma.</p>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}
