import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import type { Heading } from "@/content/text";

/*
 * Página de artículo (centro de ayuda y guías): medida de 68ch, índice
 * lateral fijo en desktop desde los h2 y plegable arriba en mobile, igual
 * que `LegalDoc`. El cuerpo es JSX plano; los estilos de prosa salen de acá.
 */

/** Estilos de prosa para el cuerpo (h2 con ancla, listas, links, código). */
export const ARTICLE_PROSE = cn(
  "text-[16px] leading-[1.7] text-adm-fg",
  "[&_h2]:mt-11 [&_h2]:scroll-mt-6 [&_h2]:text-[21px] [&_h2]:leading-snug [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_h2:first-child]:mt-0",
  "[&_h3]:mt-7 [&_h3]:text-[16px] [&_h3]:leading-snug [&_h3]:font-semibold",
  "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1.5 [&_li]:pl-1",
  "[&_li::marker]:text-adm-fg-muted [&_a]:text-adm-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:no-underline [&_strong]:font-semibold",
  "[&_code]:rounded-[3px] [&_code]:bg-adm-surface-2 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px] [&_code]:break-words",
);

export interface Crumb {
  href: string;
  label: string;
}

function Toc({ headings }: { headings: readonly Heading[] }) {
  return (
    <ol className="space-y-1.5 text-[13px]">
      {headings.map((h, i) => (
        <li key={h.id} className="flex gap-2">
          <span className="tnum w-5 shrink-0 text-right text-adm-fg-muted">{i + 1}.</span>
          <a href={`#${h.id}`} className="text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline">
            {h.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function ArticleDoc({
  variant = "help",
  breadcrumb,
  title,
  lead,
  meta,
  headings,
  actions,
  children,
  after,
}: {
  variant?: "help" | "guide";
  breadcrumb: readonly Crumb[];
  title: string;
  lead?: ReactNode;
  /** Línea de datos: sección, minutos de lectura, fecha. */
  meta: ReactNode;
  headings: readonly Heading[];
  /** Debajo de la línea de datos (por ejemplo, "Abrir en el panel"). */
  actions?: ReactNode;
  children: ReactNode;
  /** Lo que va debajo del cuerpo, en la misma columna (relacionados, contacto, CTA). */
  after?: ReactNode;
}) {
  const guide = variant === "guide";
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <header className="max-w-[68ch] border-b border-adm-border pb-6">
        <nav aria-label="Ubicación" className="text-[13px] text-adm-fg-muted">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {breadcrumb.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>/</span> : null}
                <Link href={c.href} className="underline-offset-4 hover:text-adm-fg hover:underline">
                  {c.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        <h1
          className={cn(
            "mt-3 font-semibold text-balance",
            guide
              ? "text-[32px] leading-[1.08] tracking-[-0.03em] sm:text-[42px]"
              : "text-[28px] leading-tight tracking-[-0.02em] sm:text-[34px]",
          )}
        >
          {title}
        </h1>
        {lead ? (
          <p className={cn("mt-4 text-pretty", guide ? "text-[19px] leading-snug tracking-[-0.01em]" : "text-[16px] leading-relaxed text-adm-fg-muted")}>
            {lead}
          </p>
        ) : null}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-adm-fg-muted">{meta}</p>
        {actions ? <div className="mt-4">{actions}</div> : null}
      </header>

      {headings.length > 1 ? (
        <details className="mt-6 rounded-adm border border-adm-border bg-adm-surface lg:hidden">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-medium">En esta página</summary>
          <nav aria-label="Índice" className="border-t border-adm-border px-4 py-3">
            <Toc headings={headings} />
          </nav>
        </details>
      ) : null}

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,68ch)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <div className={ARTICLE_PROSE}>{children}</div>
          {after}
        </div>
        <aside className="hidden lg:block">
          {headings.length > 1 ? (
            <nav aria-label="Índice" className="sticky top-6 border-l border-adm-border pl-5">
              <p className="mb-3 text-[12px] font-medium text-adm-fg-muted">En esta página</p>
              <Toc headings={headings} />
            </nav>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
