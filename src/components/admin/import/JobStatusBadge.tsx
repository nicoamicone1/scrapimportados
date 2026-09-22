import { Badge, type BadgeTone } from "@/components/ui";
import type { ItemStatus, JobPhase, JobStatus } from "@/lib/scraper/job";
import { ITEM_STATUS_LABELS, JOB_STATUS_LABELS } from "@/lib/scraper/job";

/** Estado de un job (el "en revisión" es un running esperando al admin). */
export function JobStatusBadge({
  status,
  phase,
  finishedAt,
}: {
  status: JobStatus;
  phase: JobPhase;
  finishedAt?: string | null;
}) {
  let tone: BadgeTone = "neutral";
  let label = JOB_STATUS_LABELS[status] ?? status;
  if (status === "running" && phase === "review") {
    tone = "purple";
    label = "En revisión";
  } else if (status === "running") tone = "blue";
  else if (status === "done") tone = "green";
  else if (status === "failed") tone = "red";
  else if (status === "cancelled") {
    tone = finishedAt ? "neutral" : "amber";
    label = finishedAt ? "Descartado" : "Pausado";
  }
  return <Badge tone={tone}>{label}</Badge>;
}

const ITEM_TONES: Record<ItemStatus, BadgeTone> = {
  pending: "amber",
  imported: "green",
  updated: "teal",
  skipped: "neutral",
  error: "red",
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge tone={ITEM_TONES[status] ?? "neutral"}>{ITEM_STATUS_LABELS[status] ?? status}</Badge>;
}
