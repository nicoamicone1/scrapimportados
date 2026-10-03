import { cn } from "@/lib/cn";

import type { FaqItem } from "./faq";

/**
 * Preguntas frecuentes a la vista (sin acordeón: se leen de un vistazo y las
 * indexa Google). Para la versión plegable, `FaqAccordion`.
 */
export function FaqList({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-12 gap-y-8 md:grid-cols-2", className)}>
      {items.map((f) => (
        <div key={f.id} id={`faq-${f.id}`} className="scroll-mt-24 border-t-2 border-eco-ink pt-4">
          <dt className="text-[16px] leading-snug font-semibold text-eco-ink">{f.q}</dt>
          <dd className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-eco-text-muted">{f.a}</dd>
        </div>
      ))}
    </dl>
  );
}
