import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CornerArc } from "@/app/(platform)/site-shapes";
import { cn } from "@/lib/cn";

import type { Heading } from "@/content/text";

import "@/app/(platform)/site.css";

import { DISPLAY } from "./brand";

/*
 * Página de artículo (centro de ayuda y guías). Tipografía de lectura:
 * Archivo de ancho normal a 17/1.7 y 64 ch (`.site-prose`, site.css),
 * titulares en display. Índice lateral fijo en desktop desde los h2 y
 * plegable arriba en mobile, igual que `LegalDoc`.
 */

/** Estilos de prosa para el cuerpo (los define `.site-prose` en site.css). */
export const ARTICLE_PROSE = "site-prose";

export interface Crumb {
  href: string;
  label: string;
}

function Toc({ headings }: { headings: readonly Heading[] }) {
  return (
    <ol className="site-toc space-y-0.5 text-[14px]">
      {headings.map((h, i) => (
        <li key={h.id}>
          <a
            href={`#${h.id}`}
            className="group flex gap-3 rounded-[12px] px-3 py-2 leading-snug text-adm-fg-muted transition-colors duration-[140ms] hover:bg-eco-niebla-2 hover:text-adm-fg"
          >
            <span aria-hidden className="tnum w-5 shrink-0 font-semibold text-eco-pomelo-ink">
              {/^\d+[.)]\s/.test(h.text) ? "·" : String(i + 1).padStart(2, "0")}
            </span>
            <span>{h.text}</span>
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
    <article>
      <header className={cn("relative overflow-hidden", guide ? "bg-eco-ink text-white" : "border-b border-eco-line bg-adm-surface")}>
        <CornerArc corner="br" size={guide ? 520 : 380} className={cn("hidden md:block", guide ? "bg-eco-ink-2" : "bg-eco-durazno/70")} />
        <div className={cn("relative mx-auto max-w-6xl px-4 sm:px-6", guide ? "pt-12 pb-14 md:pt-20 md:pb-20" : "pt-10 pb-10 md:pt-14 md:pb-12")}>
          <nav aria-label="Ubicación" className="text-[13px]">
            <ol className="flex flex-wrap items-center gap-1.5">
              {breadcrumb.map((c, i) => (
                <li key={c.href} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <span aria-hidden className={guide ? "text-eco-bruma" : "text-adm-fg-muted"}>
                      /
                    </span>
                  ) : null}
                  <Link
                    href={c.href}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-full px-3 font-medium transition-colors duration-[140ms]",
                      guide ? "bg-eco-ink-2 text-eco-mist hover:bg-eco-ink-3" : "bg-eco-niebla-2 text-adm-fg hover:bg-eco-line",
                    )}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <h1
            className={cn(
              DISPLAY,
              "eco-pop mt-6 max-w-[22ch] text-balance",
              guide ? "text-[38px] leading-[1] sm:text-[56px]" : "text-[32px] leading-[1.04] sm:text-[44px]",
            )}
          >
            {title}
          </h1>
          {lead ? (
            <p
              className={cn(
                "eco-pop mt-5 max-w-[60ch] text-pretty [--i:1]",
                guide ? "text-[19px] leading-[1.45] text-eco-mist sm:text-[21px]" : "text-[17px] leading-relaxed text-adm-fg-muted",
              )}
            >
              {lead}
            </p>
          ) : null}
          <p className={cn("mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]", guide ? "text-eco-bruma" : "text-adm-fg-muted")}>{meta}</p>
          {actions ? <div className="mt-6">{actions}</div> : null}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        {headings.length > 1 ? (
          <details className="group mb-10 rounded-eco-lg border border-eco-line bg-adm-surface lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              En esta página
              <ChevronDown className="size-4 transition-transform duration-[240ms] ease-eco-out group-open:rotate-180" strokeWidth={2} aria-hidden />
            </summary>
            <nav aria-label="Índice" className="border-t border-eco-line px-1 py-2">
              <Toc headings={headings} />
            </nav>
          </details>
        ) : null}

        <div className="lg:grid lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:gap-20">
          <div className="min-w-0">
            <div className={ARTICLE_PROSE}>{children}</div>
            {after}
          </div>
          <aside className="hidden lg:block">
            {headings.length > 1 ? (
              <nav aria-label="Índice" className="sticky top-24">
                <p className="mb-2 px-3 text-[12px] font-semibold tracking-[0.08em] text-adm-fg-muted uppercase">En esta página</p>
                <Toc headings={headings} />
              </nav>
            ) : null}
          </aside>
        </div>
      </div>
    </article>
  );
}
