import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  dueState,
  formatYmdShort,
  JOB_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  type JobStatus,
  type QuoteStatus,
} from "@/lib/admin/print3d-production-utils";

/* Piezas chicas del Taller 3D (server-friendly): swatch, badges y fecha comprometida. */

const JOB_TONES: Record<JobStatus, BadgeTone> = {
  queued: "neutral",
  printing: "blue",
  post: "purple",
  done: "green",
  failed: "red",
  cancelled: "neutral",
};

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <Badge tone={JOB_TONES[status]} className={className}>
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}

const QUOTE_TONES: Record<QuoteStatus, BadgeTone> = {
  pending_review: "amber",
  priced: "blue",
  ordered: "green",
  expired: "neutral",
  rejected: "red",
};

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <Badge tone={QUOTE_TONES[status]} className={className}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Muestra de filamento: círculo con el hex del color y un anillo que separa
 * los colores claros (blanco, natural) del fondo.
 */
export function Swatch({ hex, size = 14, className, title }: { hex: string | null | undefined; size?: number; className?: string; title?: string }) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      title={title}
      className={cn("inline-block shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)]", className)}
      style={{ width: size, height: size, background: hex || "repeating-linear-gradient(45deg,#ddd 0 3px,#f4f4f4 3px 6px)" }}
    />
  );
}

/** Fecha comprometida: roja si se pasó, ámbar hoy o en 2 días, gris si sobra. */
export function DueChip({ due, today, status, className }: { due: string | null; today: string; status?: string; className?: string }) {
  if (!due) return null;
  const state = dueState(due, today, status);
  const label = formatYmdShort(due);
  const cls = {
    overdue: "bg-[var(--adm-badge-red-bg)] text-[var(--adm-badge-red-fg)] font-semibold",
    today: "bg-[var(--adm-badge-amber-bg)] text-[var(--adm-badge-amber-fg)] font-semibold",
    soon: "bg-[var(--adm-badge-amber-bg)] text-[var(--adm-badge-amber-fg)]",
    ok: "bg-adm-surface-2 text-adm-fg-muted",
    none: "",
  }[state];
  const text = state === "overdue" ? `Vencido · ${label}` : state === "today" ? "Entrega hoy" : `Entrega ${label}`;
  return (
    <span
      className={cn("tnum inline-flex h-5 items-center rounded-adm-sm px-1.5 text-xs whitespace-nowrap", cls, className)}
      title={`Fecha comprometida: ${label}`}
    >
      {text}
    </span>
  );
}
