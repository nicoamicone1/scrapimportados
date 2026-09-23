import type { ReactNode } from "react";

import { formatLegalDate } from "./site";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

/*
 * Documento legal de la plataforma (/terminos, /privacidad): medida de 68ch,
 * índice lateral fijo en desktop y plegable arriba en mobile, secciones
 * numeradas con ancla. El contenido es JSX plano (p, ul, strong, a); los
 * estilos de prosa salen de acá.
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
    <ol className="space-y-1.5 text-[13px]">
      {sections.map((s, i) => (
        <li key={s.id} className="flex gap-2">
          <span className="tnum w-5 shrink-0 text-right text-adm-fg-muted">{i + 1}.</span>
          <a href={`#${s.id}`} className="text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline">
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <header className="max-w-[68ch] border-b border-adm-border pb-6">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] sm:text-[36px]">{title}</h1>
        <p className="mt-2 text-[13px] text-adm-fg-muted">
          Última actualización: <time dateTime={updatedAt}>{formatLegalDate(updatedAt)}</time>
        </p>
        <div className="mt-4 text-[15px] leading-[1.65] text-adm-fg [&_p+p]:mt-3">{intro}</div>
      </header>

      <details className="mt-6 rounded-adm border border-adm-border bg-adm-surface lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium">Índice</summary>
        <nav aria-label="Índice" className="border-t border-adm-border px-4 py-3">
          {toc}
        </nav>
      </details>

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,68ch)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0 space-y-10 text-[15px] leading-[1.65] [&_a]:text-adm-accent [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-1.5 [&_li]:pl-1 [&_p]:mt-3 [&_strong]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-6">
              <h2 id={`${s.id}-t`} className="flex gap-2 text-[18px] leading-snug font-semibold tracking-[-0.01em]">
                <span className="tnum text-adm-fg-muted">{i + 1}.</span>
                <span>{s.title}</span>
              </h2>
              {s.content}
            </section>
          ))}
        </div>
        <aside className="hidden lg:block">
          <nav aria-label="Índice" className="sticky top-6 border-l border-adm-border pl-5">
            <p className="mb-3 text-[12px] font-medium text-adm-fg-muted">En esta página</p>
            {toc}
          </nav>
        </aside>
      </div>
    </div>
  );
}
