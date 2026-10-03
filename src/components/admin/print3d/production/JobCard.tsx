"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Ban, Check, GripVertical, MoreHorizontal, Play, TriangleAlert, Undo2 } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/Button";
import { DropdownItem, DropdownMenu } from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/cn";
import { formatGrams, formatMinutes, printProgress, remainingMinutes } from "@/lib/admin/print3d-production-utils";

import { DueChip, JobStatusBadge, Swatch } from "./bits";
import type { Job, JobLook } from "./types";

export type JobAction = "start" | "finish" | "fail" | "cancel";

export interface JobCardProps {
  job: Job;
  look: JobLook;
  today: string;
  now: Date;
  /** Tinta de la impresora (barra de progreso). */
  printerColor?: string | null;
  canStart: boolean;
  startBlockedReason?: string | null;
  onAction: (action: JobAction, job: Job) => void;
  /** Deshabilita el arrastre (filtros activos o trabajo imprimiendo). */
  dragDisabled?: boolean;
  /** Render dentro del DragOverlay (sin sortable). */
  overlay?: boolean;
}

/** Tarjeta de un trabajo en el tablero, con arrastre por la manija. */
export function SortableJobCard(props: JobCardProps) {
  const disabled = props.dragDisabled || props.job.status !== "queued";
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.job.id,
    disabled,
    data: { type: "job" },
  });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <JobCard
        {...props}
        handle={
          disabled ? null : (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Mover «${props.job.title}»`}
              className="-ml-1 inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg active:cursor-grabbing sm:size-6"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          )
        }
      />
    </div>
  );
}

export function JobCard({
  job,
  look,
  today,
  now,
  printerColor,
  canStart,
  startBlockedReason,
  onAction,
  overlay,
  handle,
}: JobCardProps & { handle?: React.ReactNode }) {
  const printing = job.status === "printing";
  const left = remainingMinutes(job, now);
  const progress = printProgress(job, now);
  const overtime = printing && job.started_at && left === 0;
  const material = [look.materialType ?? look.materialName, look.colorName].filter(Boolean).join(" ");

  return (
    <article
      aria-label={job.title}
      className={cn(
        "rounded-[14px] border bg-adm-surface p-3 shadow-adm-card",
        printing ? "border-adm-fg/25" : "border-adm-border",
        overlay && "rotate-1 shadow-[var(--adm-shadow)]",
      )}
    >
      <div className="flex items-start gap-2">
        {handle}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-adm-fg-muted">
            <Swatch hex={look.hex} size={14} title={look.colorName ?? undefined} />
            <span className="truncate font-medium text-adm-fg">{material || "Sin material"}</span>
            {look.qualityName ? <span className="truncate">· {look.qualityName}</span> : null}
            {job.order_number !== null && job.order_id ? (
              <Link href={`/admin/pedidos/${job.order_id}`} className="tnum ml-auto shrink-0 font-medium text-adm-link hover:underline">
                #{job.order_number}
              </Link>
            ) : null}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm leading-5 font-medium text-adm-fg">
            {job.parent_job_id ? (
              <span className="mr-1 inline-flex translate-y-0.5 text-adm-accent-2-ink" title="Reimpresión de un trabajo que falló">
                <Undo2 className="size-3.5" aria-label="Reimpresión" />
              </span>
            ) : null}
            {job.title}
          </h3>
          <div className="tnum mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-adm-fg-muted">
            {job.qty > 1 ? <span className="font-medium text-adm-fg">× {job.qty}</span> : null}
            <span>{formatMinutes(job.est_minutes)}</span>
            {job.est_grams ? <span>{formatGrams(job.est_grams)}</span> : null}
            {job.status !== "queued" && job.status !== "printing" ? <JobStatusBadge status={job.status} /> : null}
            <DueChip due={job.due_date} today={today} status={job.status} className="ml-auto" />
          </div>
        </div>
      </div>

      {printing ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-adm-fg-muted">{overtime ? "Pasó lo estimado" : "Faltan"}</span>
            <span className={cn("tnum text-xl leading-6 font-semibold", overtime ? "text-adm-warning" : "text-adm-fg")}>
              {overtime ? `+${formatMinutes((now.getTime() - new Date(job.started_at!).getTime()) / 60_000 - (job.est_minutes ?? 0))}` : formatMinutes(left)}
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-adm-surface-2"
            role="progressbar"
            aria-label="Avance estimado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full rounded-full" style={{ width: `${Math.max(3, progress * 100)}%`, background: printerColor || "var(--adm-accent)" }} />
          </div>
        </div>
      ) : null}

      {overlay ? null : (
        <div className="mt-3 flex items-center gap-2">
          {job.status === "queued" ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Play />}
              className="h-10 flex-1 sm:h-7 sm:flex-none"
              disabled={!canStart}
              title={!canStart && startBlockedReason ? startBlockedReason : undefined}
              onClick={() => onAction("start", job)}
            >
              Empezar
            </Button>
          ) : (
            <>
              <Button size="sm" variant="primary" icon={<Check />} className="h-10 flex-1 sm:h-7 sm:flex-none" onClick={() => onAction("finish", job)}>
                Terminar
              </Button>
              <Button size="sm" icon={<TriangleAlert />} className="h-10 flex-1 sm:h-7 sm:flex-none" onClick={() => onAction("fail", job)}>
                Falló
              </Button>
            </>
          )}
          <DropdownMenu
            align="end"
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label={`Más acciones de «${job.title}»`} className="ml-auto size-10 sm:size-7">
                <MoreHorizontal />
              </Button>
            }
          >
            {job.status === "queued" && !canStart && startBlockedReason ? (
              <p className="px-2.5 py-1.5 text-xs text-adm-fg-muted">{startBlockedReason}</p>
            ) : null}
            <DropdownItem icon={<Ban />} danger onSelect={() => onAction("cancel", job)}>
              Cancelar trabajo
            </DropdownItem>
          </DropdownMenu>
        </div>
      )}
    </article>
  );
}
