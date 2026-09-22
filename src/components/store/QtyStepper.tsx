"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/cn";

/** Stepper de cantidad (32px en el drawer, alto de control en la ficha). */
export function QtyStepper({
  value,
  onChange,
  max,
  min = 1,
  size = "sm",
  label,
}: {
  value: number;
  onChange: (qty: number) => void;
  max?: number | null;
  min?: number;
  size?: "sm" | "md";
  /** Nombre del producto para los aria-label. */
  label: string;
}) {
  const limit = max != null ? Math.max(max, min) : 999;
  const btn = cn("inline-flex items-center justify-center disabled:opacity-35", size === "sm" ? "size-8" : "w-10 self-stretch");
  return (
    <div
      className={cn("inline-flex items-center rounded-md border border-border-strong", size === "md" && "min-h-[var(--control-h)]")}
      role="group"
      aria-label={`Cantidad de ${label}`}
    >
      <button type="button" className={btn} aria-label={`Restar uno de ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className={cn("tnum text-center text-sm", size === "sm" ? "w-7" : "w-9")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} aria-label={`Sumar uno de ${label}`} disabled={value >= limit} onClick={() => onChange(value + 1)}>
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
