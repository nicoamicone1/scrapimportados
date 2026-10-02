"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import {
  FAILURE_REASONS,
  FAILURE_REASON_LABELS,
  formatGrams,
  formatMinutes,
  printProgress,
  type FailureReason,
} from "@/lib/admin/print3d-production-utils";
import { cancelJob, failJob, finishJob, startJob } from "@/app/admin/(panel)/taller-3d/cola/actions";

import { Swatch } from "./bits";
import type { BoardSpool, Job, JobLook } from "./types";
import type { JobAction } from "./JobCard";

/*
 * Dialogs de las acciones de un trabajo: Empezar (bobina), Terminar (reales
 * → RPC print3d_finish_job), Falló (motivo, gramos tirados, reimprimir →
 * RPC print3d_fail_job) y Cancelar.
 */

export interface JobDialogState {
  action: JobAction;
  job: Job;
}

interface Props {
  state: JobDialogState | null;
  onClose: () => void;
  onDone: () => void;
  look: JobLook | null;
  spools: BoardSpool[];
  printerName: string | null;
  now: Date;
}

export function JobDialogs({ state, onClose, onDone, look, spools, printerName, now }: Props) {
  const job = state?.job ?? null;
  const open = (a: JobAction) => state?.action === a;
  const setOpen = (o: boolean) => {
    if (!o) onClose();
  };
  return (
    <>
      {job && open("start") ? (
        <StartDialog job={job} look={look} spools={spools} printerName={printerName} onOpenChange={setOpen} onDone={onDone} />
      ) : null}
      {job && open("finish") ? (
        <FinishDialog job={job} look={look} spools={spools} now={now} onOpenChange={setOpen} onDone={onDone} />
      ) : null}
      {job && open("fail") ? <FailDialog job={job} now={now} onOpenChange={setOpen} onDone={onDone} /> : null}
      <ConfirmDialog
        open={Boolean(job && open("cancel"))}
        onOpenChange={setOpen}
        title="¿Cancelar este trabajo?"
        description={
          job
            ? `«${job.title}» sale de la cola. Si el pedido sigue en curso, vuelve a aparecer en "Pedidos por producir" para mandarlo de nuevo.`
            : undefined
        }
        confirmLabel="Cancelar trabajo"
        cancelLabel="Volver"
        destructive
        onConfirm={async () => {
          if (!job) return;
          const res = await cancelJob({ jobId: job.id });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Trabajo cancelado.");
          onDone();
        }}
      />
    </>
  );
}

/** Bobinas del color del trabajo con algo de filamento: abiertas primero, la más gastada arriba. */
function spoolOptions(spools: BoardSpool[], colorId: string | null, keep: string | null = null) {
  return spools
    .filter((s) => s.id === keep || (s.status !== "empty" && (!colorId || s.color_id === colorId)))
    .sort((a, b) => (a.status === b.status ? a.remaining_grams - b.remaining_grams : a.status === "open" ? -1 : 1));
}

function spoolLabel(s: BoardSpool) {
  return `${s.brand ? `${s.brand} · ` : ""}${formatGrams(s.remaining_grams)} de ${formatGrams(s.net_grams)}${s.status === "sealed" ? " (cerrada)" : ""}`;
}

function StartDialog({
  job,
  look,
  spools,
  printerName,
  onOpenChange,
  onDone,
}: {
  job: Job;
  look: JobLook | null;
  spools: BoardSpool[];
  printerName: string | null;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const options = spoolOptions(spools, job.color_id);
  const [spoolId, setSpoolId] = useState(job.spool_id ?? options[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const chosen = options.find((s) => s.id === spoolId);
  const short = chosen && job.est_grams ? chosen.remaining_grams < job.est_grams : false;

  const submit = async () => {
    setPending(true);
    const res = await startJob({ jobId: job.id, spoolId: spoolId || null });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Imprimiendo en ${printerName ?? "la impresora"}.`);
    onDone();
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      dismissable={!pending}
      title="Empezar a imprimir"
      description={`${job.title}${printerName ? ` · en ${printerName}` : ""}`}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} loadingText="Empezando…">
            Empezar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[13px]">
          <Swatch hex={look?.hex} size={18} />
          <span className="font-medium">{[look?.materialType, look?.colorName].filter(Boolean).join(" ") || "Sin color definido"}</span>
          <span className="tnum ml-auto text-adm-fg-muted">
            Necesita {formatGrams(job.est_grams)} · {formatMinutes(job.est_minutes)}
          </span>
        </div>
        <Field
          label="Bobina"
          hint={
            options.length
              ? "Se descuenta lo que pese de verdad cuando lo termines."
              : "No hay bobinas cargadas de este color. Podés empezar igual y cargarla en Filamento."
          }
          error={short ? `A esta bobina le quedan ${formatGrams(chosen!.remaining_grams)}: no alcanza para todo el trabajo.` : null}
        >
          <Select value={spoolId} onChange={(e) => setSpoolId(e.target.value)}>
            <option value="">Sin bobina asignada</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {spoolLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

const toNumber = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

function FinishDialog({
  job,
  look,
  spools,
  now,
  onOpenChange,
  onDone,
}: {
  job: Job;
  look: JobLook | null;
  spools: BoardSpool[];
  now: Date;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const options = spoolOptions(spools, job.color_id, job.spool_id);
  const elapsed = job.started_at ? Math.max(1, Math.round((now.getTime() - new Date(job.started_at).getTime()) / 60_000)) : null;
  const [grams, setGrams] = useState(String(Math.round(job.est_grams ?? 0)));
  const [minutes, setMinutes] = useState(String(Math.round(job.est_minutes ?? 0)));
  const [post, setPost] = useState(String(Math.round(job.post_minutes ?? 0)));
  const [spoolId, setSpoolId] = useState(job.spool_id ?? "");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const res = await finishJob({
      jobId: job.id,
      actualGrams: toNumber(grams),
      actualMinutes: toNumber(minutes),
      postMinutes: toNumber(post || "0"),
      spoolId: spoolId || null,
    });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(`«${job.title}» terminado.${spoolId ? " Descontamos el filamento de la bobina." : ""}`);
    onDone();
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      dismissable={!pending}
      size="lg"
      title="Terminar trabajo"
      description={job.title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} loadingText="Guardando…">
            Terminar
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-adm-fg-muted">
        Cargá lo que pesó y lo que tardó de verdad: con eso se descuenta la bobina, se suman horas a la impresora y se afina el
        cotizador para la próxima.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gramos reales" hint={`Estimado: ${formatGrams(job.est_grams)}`} error={errors.actualGrams}>
          <Input type="number" inputMode="decimal" min={0} step="1" value={grams} onChange={(e) => setGrams(e.target.value)} trailing="g" />
        </Field>
        <Field
          label="Minutos de impresión"
          hint={
            elapsed ? (
              <>
                Estimado: {formatMinutes(job.est_minutes)} · desde que empezó: {formatMinutes(elapsed)}{" "}
                <button type="button" className="font-medium text-adm-accent hover:underline" onClick={() => setMinutes(String(elapsed))}>
                  Usar
                </button>
              </>
            ) : (
              `Estimado: ${formatMinutes(job.est_minutes)}`
            )
          }
          error={errors.actualMinutes}
        >
          <Input type="number" inputMode="numeric" min={1} step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} trailing="min" />
        </Field>
        <Field label="Bobina" hint={look?.colorName ? `De ${look.colorName}.` : undefined} error={errors.spoolId}>
          <Select value={spoolId} onChange={(e) => setSpoolId(e.target.value)}>
            {/* Con bobina ya elegida al empezar, la RPC descuenta de esa: no se ofrece "ninguna". */}
            {job.spool_id ? null : <option value="">No descontar de ninguna</option>}
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {spoolLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Post-proceso" hint="Sacar soportes, lijar, pegar. Suma mano de obra al costo." error={errors.postMinutes}>
          <Input type="number" inputMode="numeric" min={0} step="1" value={post} onChange={(e) => setPost(e.target.value)} trailing="min" />
        </Field>
      </div>
    </Dialog>
  );
}

function FailDialog({ job, now, onOpenChange, onDone }: { job: Job; now: Date; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  // Lo tirado arranca en lo que llevaba impreso (proporcional al tiempo).
  const guess = Math.round((job.est_grams ?? 0) * (printProgress(job, now) || 0.5));
  const [reason, setReason] = useState<FailureReason | "">("");
  const [wasted, setWasted] = useState(String(guess));
  const [requeue, setRequeue] = useState(true);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const res = await failJob({ jobId: job.id, reason, wastedGrams: toNumber(wasted || "0"), requeue });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(res.data.requeuedJobId ? "Marcado como fallado. La reimpresión quedó al final de la misma impresora." : "Marcado como fallado.");
    onDone();
  };

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      dismissable={!pending}
      size="lg"
      title="Falló la impresión"
      description={job.title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="danger" onClick={submit} loading={pending} loadingText="Guardando…" disabled={!reason}>
            {requeue ? "Marcar y reimprimir" : "Marcar como fallado"}
          </Button>
        </>
      }
    >
      <fieldset>
        <legend className="text-[13px] font-medium text-adm-fg">¿Qué pasó?</legend>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {FAILURE_REASONS.map((r) => (
            <label
              key={r}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 rounded-adm border px-3 py-2 text-[13px]",
                reason === r ? "border-adm-accent bg-adm-accent-soft" : "border-adm-border hover:bg-adm-row-hover",
              )}
            >
              <input
                type="radio"
                name="failure-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="accent-[var(--adm-accent)]"
              />
              {FAILURE_REASON_LABELS[r]}
            </label>
          ))}
        </div>
        {errors.reason ? <p className="mt-1 text-xs text-adm-danger">{errors.reason[0]}</p> : null}
      </fieldset>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Filamento tirado" hint="Se descuenta de la bobina del trabajo y cuenta como desperdicio." error={errors.wastedGrams}>
          <Input type="number" inputMode="decimal" min={0} step="1" value={wasted} onChange={(e) => setWasted(e.target.value)} trailing="g" />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox
            checked={requeue}
            onChange={(e) => setRequeue(e.target.checked)}
            label="Reimprimir"
            description="Crea el mismo trabajo al final de la cola de esa impresora."
          />
        </div>
      </div>
    </Dialog>
  );
}
