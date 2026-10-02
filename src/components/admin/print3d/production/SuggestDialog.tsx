"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { assignJobs } from "@/app/admin/(panel)/taller-3d/cola/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatHoursShort, formatMinutes, remainingMinutes, suggestAssignments } from "@/lib/admin/print3d-production-utils";

import { Swatch } from "./bits";
import { lookFor, type BoardData } from "./types";

/**
 * "Sugerir asignación": greedy §3.5 sobre los trabajos sin impresora (los
 * más largos primero, cada uno a la compatible con menos carga). Muestra la
 * propuesta y la aplica de una con `assignJobs`.
 */
export function SuggestDialog({
  open,
  onOpenChange,
  data,
  now,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: BoardData;
  now: Date;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);

  const plan = useMemo(() => {
    const active = data.printers.filter((p) => p.status === "active");
    const unassigned = data.jobs.filter((j) => !j.printer_id && j.status === "queued");
    const typeOf = new Map(data.catalog.materials.map((m) => [m.id, m.type]));
    const before: Record<string, number> = {};
    for (const p of active) {
      before[p.id] = data.jobs.filter((j) => j.printer_id === p.id).reduce((s, j) => s + remainingMinutes(j, now), 0);
    }
    const s = suggestAssignments(
      active.map((p) => ({ id: p.id, bed: p.bed, materials: p.materials, backlog_minutes: before[p.id] })),
      unassigned.map((j) => ({
        id: j.id,
        minutes: Number(j.est_minutes ?? 0),
        material_type: j.material_id ? (typeOf.get(j.material_id) ?? null) : null,
        bbox: j.bbox,
      })),
    );
    const byPrinter = active
      .map((p) => ({
        printer: p,
        jobs: s.assignments.filter((a) => a.printerId === p.id).map((a) => unassigned.find((j) => j.id === a.jobId)!),
        before: before[p.id],
        after: s.loads[p.id],
      }))
      .filter((g) => g.jobs.length);
    return { s, byPrinter, unplaceable: s.unplaceable.map((id) => unassigned.find((j) => j.id === id)!), activeCount: active.length };
  }, [data, now]);

  const apply = async () => {
    setPending(true);
    const res = await assignJobs({ assignments: plan.s.assignments });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${res.data.assigned} ${res.data.assigned === 1 ? "trabajo asignado" : "trabajos asignados"}.`);
    onOpenChange(false);
    onDone();
  };

  const days = (min: number) => min / 60 / Math.max(1, data.dailyPrintHours);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissable={!pending}
      size="lg"
      title="Sugerir asignación"
      description="Los trabajos más largos primero, cada uno a la impresora compatible (material y cama) que se libera antes."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            Volver
          </Button>
          <Button variant="primary" onClick={apply} loading={pending} disabled={!plan.s.assignments.length}>
            {plan.s.assignments.length ? `Asignar ${plan.s.assignments.length}` : "Nada para asignar"}
          </Button>
        </>
      }
    >
      {plan.activeCount === 0 ? (
        <p className="text-[13px] text-adm-fg-muted">No hay impresoras activas. Activá alguna en Impresoras para poder repartir la cola.</p>
      ) : null}
      <div className="space-y-4">
        {plan.byPrinter.map((g) => (
          <section key={g.printer.id}>
            <header className="flex items-baseline gap-2 border-b border-adm-border pb-1.5">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: g.printer.color }} />
              <h3 className="text-sm font-semibold">{g.printer.name}</h3>
              <span className="tnum ml-auto text-xs text-adm-fg-muted">
                {formatHoursShort(g.before)} → <span className="font-medium text-adm-fg">{formatHoursShort(g.after)}</span> (
                {days(g.after).toLocaleString("es-AR", { maximumFractionDigits: 1 })} días)
              </span>
            </header>
            <ul className="mt-1.5 space-y-1">
              {g.jobs.map((j) => {
                const look = lookFor(j, data.catalog);
                return (
                  <li key={j.id} className="flex items-center gap-2 text-[13px]">
                    <Swatch hex={look.hex} size={12} />
                    <span className="min-w-0 flex-1 truncate">{j.title}</span>
                    <span className="tnum shrink-0 text-adm-fg-muted">{formatMinutes(j.est_minutes)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {plan.unplaceable.length ? (
          <section className="rounded-adm border border-[#F1C9C3] bg-[#FBEFED] px-3 py-2.5">
            <h3 className="text-[13px] font-semibold text-[#9B2218]">Sin impresora que pueda</h3>
            <p className="text-xs text-[#9B2218]">No entran en la cama o ninguna impresora activa imprime ese material. Quedan sin asignar.</p>
            <ul className="mt-1.5 space-y-0.5 text-[13px]">
              {plan.unplaceable.map((j) => (
                <li key={j.id} className="truncate">
                  {j.title}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {!plan.byPrinter.length && !plan.unplaceable.length && plan.activeCount > 0 ? (
          <p className="text-[13px] text-adm-fg-muted">No hay trabajos sin impresora.</p>
        ) : null}
      </div>
    </Dialog>
  );
}
