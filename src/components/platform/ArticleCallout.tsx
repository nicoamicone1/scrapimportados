import { Info, Scale, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "nota" | "aviso" | "legal";

const TONES: Record<Tone, { label: string; icon: typeof Info; box: string; badge: string }> = {
  nota: { label: "Nota", icon: Info, box: "bg-eco-azul-soft", badge: "bg-adm-link text-white" },
  aviso: { label: "Ojo", icon: TriangleAlert, box: "bg-eco-durazno", badge: "bg-eco-ink text-white" },
  legal: { label: "Orientativo", icon: Scale, box: "bg-eco-niebla-2", badge: "bg-adm-surface text-adm-fg ring-1 ring-eco-line" },
};

/**
 * Aviso dentro de un artículo de ayuda o guía: una burbuja (BRAND §7.2, lo
 * que "habla") en azul lavado (nota), durazno (aviso) o niebla (legal), con
 * la etiqueta en una pastilla. `title` reemplaza la etiqueta del tono.
 */
export function Callout({ tone = "nota", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <aside className={cn("eco-bubble my-7 px-5 py-5 text-[15px] leading-relaxed text-eco-ink [--eco-bubble-r:22px] sm:px-6", t.box)}>
      <p className={cn("!mt-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold tracking-[0.04em] uppercase", t.badge)}>
        <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
        {title ?? t.label}
      </p>
      <div className="mt-2 [&>*:first-child]:!mt-1">{children}</div>
    </aside>
  );
}
