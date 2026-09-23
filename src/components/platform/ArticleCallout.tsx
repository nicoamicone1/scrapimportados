import { Info, Scale, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "nota" | "aviso" | "legal";

const TONES: Record<Tone, { label: string; icon: typeof Info; className: string; ink: string }> = {
  nota: { label: "Nota", icon: Info, className: "border-adm-accent bg-adm-accent-soft", ink: "text-adm-accent" },
  aviso: { label: "Ojo", icon: TriangleAlert, className: "border-adm-accent-2 bg-adm-accent-2-soft", ink: "text-adm-accent-2-ink" },
  legal: { label: "Orientativo", icon: Scale, className: "border-adm-fg-muted bg-adm-surface-2", ink: "text-adm-fg-muted" },
};

/**
 * Aviso dentro de un artículo de ayuda o guía: regla izquierda de 3 px y
 * fondo lavado, ícono de 16 px en línea con la etiqueta (sin círculos).
 * `title` reemplaza la etiqueta por defecto del tono.
 */
export function Callout({ tone = "nota", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <aside className={cn("mt-5 rounded-r-adm border-l-[3px] px-4 py-3 text-[14px] leading-relaxed", t.className)}>
      <p className={cn("!mt-0 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.04em] uppercase", t.ink)}>
        <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        {title ?? t.label}
      </p>
      <div className="[&>*:first-child]:!mt-1">{children}</div>
    </aside>
  );
}
