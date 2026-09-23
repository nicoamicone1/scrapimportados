"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

import { useUrlPending } from "./useUrlTransition";

/**
 * Velo translúcido con spinner chico sobre una tabla/panel mientras llega el
 * resultado de un filtro. Si `pending` no se pasa, usa el del
 * `<UrlPendingScope>` más cercano (filtros con `useUrlTransition`).
 */
export function PendingOverlay({ pending, label = "Actualizando…", className }: { pending?: boolean; label?: string; className?: string }) {
  const scoped = useUrlPending();
  const show = pending ?? scoped;
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "adm-pending-overlay absolute inset-0 z-[2] flex cursor-progress items-start justify-center bg-adm-surface/60 pt-14",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 rounded-adm border border-adm-border bg-adm-surface px-2.5 py-1.5 text-xs text-adm-fg-muted shadow-adm-card">
        <Loader2 className="size-3.5 animate-spin text-adm-accent-2-ink" aria-hidden />
        {label}
      </span>
    </div>
  );
}
