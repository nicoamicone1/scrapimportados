import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { CornerArc } from "@/app/(platform)/site-shapes";

import "@/app/(platform)/site.css";

import { DISPLAY, EYEBROW } from "./brand";
import { formatLegalDate } from "./site";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

/*
 * Documento legal de la plataforma (/terminos, /privacidad): sobrio pero de
 * marca. Título en display, la fecha de la versión vigente en una pastilla,
 * índice numerado fijo a la izquierda en desktop (plegable arriba en mobile)
 * y secciones con su número en Archivo expandida. Lectura a 64 ch.
 */
export function LegalDoc({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  /** Fecha ISO de la versión vigente. */
  updatedAt: string;
  intro: ReactNode;
  sections: readonly LegalSection[];
}) {
  const toc = (
    <ol className="space-y-0.5 text-[14px]">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="flex gap-3 rounded-[12px] px-3 py-2 leading-snug text-adm-fg-muted transition-colors duration-[140ms] hover:bg-eco-niebla-2 hover:text-adm-fg"
          >
            <span className="tnum w-5 shrink-0 font-semibold text-eco-pomelo-ink">{String(i + 1).padStart(2, "0")}</span>
            <span>{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <article>
      <header className="relative overflow-hidden border-b border-eco-line bg-adm-surface">
        <CornerArc corner="br" size={360} className="hidden bg-eco-niebla-2 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-6 md:pt-16 md:pb-14">
          <p className={EYEBROW}>Legales</p>
          <h1 className={`${DISPLAY} mt-4 text-[38px] leading-[1] sm:text-[52px]`}>{title}</h1>
          <p className="mt-5 inline-flex rounded-full bg-eco-niebla-2 px-3.5 py-1.5 text-[13px]">
            Versión vigente desde el&nbsp;<time dateTime={updatedAt} className="font-semibold">{formatLegalDate(updatedAt)}</time>
          </p>
          <div className="mt-6 max-w-[64ch] text-[17px] leading-[1.6] text-adm-fg [&_a]:font-medium [&_a]:text-adm-link [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-4 [&_p+p]:mt-3">
            {intro}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        <details className="group mb-10 rounded-eco-lg border border-eco-line bg-adm-surface lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
            Índice
            <ChevronDown className="size-4 transition-transform duration-[240ms] ease-eco-out group-open:rotate-180" strokeWidth={2} aria-hidden />
          </summary>
          <nav aria-label="Índice" className="border-t border-eco-line px-1 py-2">
            {toc}
          </nav>
        </details>

        <div className="lg:grid lg:grid-cols-[260px_minmax(0,680px)] lg:gap-16">
          <aside className="hidden lg:block">
            <nav aria-label="Índice" className="sticky top-24">
              <p className="mb-2 px-3 text-[12px] font-semibold tracking-[0.08em] text-adm-fg-muted uppercase">En esta página</p>
              {toc}
            </nav>
          </aside>
          <div className="site-prose min-w-0 space-y-14 text-[16px]">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-24">
                <h2 id={`${s.id}-t`} className="!mt-0 flex items-baseline gap-3">
                  <span className="eco-num text-[15px] text-eco-pomelo-ink">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.title}</span>
                </h2>
                {s.content}
              </section>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
