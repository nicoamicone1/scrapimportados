import { Plus } from "lucide-react";

import { cn } from "@/lib/cn";

import type { FaqItem } from "./faq";

/**
 * Preguntas frecuentes plegables (/planes, /contacto): la pregunta es el
 * botón, el más gira a cruz con rebote y la respuesta queda en el HTML (la
 * indexa Google y la encuentra el Ctrl+F del navegador). La primera abierta.
 */
export function FaqAccordion({ items, className, openFirst = true }: { items: readonly FaqItem[]; className?: string; openFirst?: boolean }) {
  return (
    <div className={cn("border-b border-eco-line", className)}>
      {items.map((f, i) => (
        <details key={f.id} id={`faq-${f.id}`} open={openFirst && i === 0} className="group scroll-mt-24 border-t border-eco-line">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[16px] font-semibold leading-snug transition-colors duration-[140ms] hover:text-adm-link [&::-webkit-details-marker]:hidden">
            {f.q}
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-eco-niebla-2 text-eco-ink transition-[transform,background-color] duration-[420ms] ease-eco-spring group-open:rotate-45 group-open:bg-eco-pomelo"
            >
              <Plus className="size-4" strokeWidth={2} />
            </span>
          </summary>
          <p className="max-w-[64ch] pr-12 pb-5 text-[15px] leading-relaxed text-adm-fg-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
