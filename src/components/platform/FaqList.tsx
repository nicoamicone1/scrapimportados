import { cn } from "@/lib/cn";

import type { FaqItem } from "./faq";

/** Preguntas frecuentes a la vista (sin acordeón: se leen de un vistazo y las indexa Google). */
export function FaqList({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-12 gap-y-7 md:grid-cols-2", className)}>
      {items.map((f) => (
        <div key={f.id} id={`faq-${f.id}`} className="scroll-mt-6 border-t border-adm-border pt-4">
          <dt className="text-[15px] font-semibold">{f.q}</dt>
          <dd className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-adm-fg-muted">{f.a}</dd>
        </div>
      ))}
    </dl>
  );
}
