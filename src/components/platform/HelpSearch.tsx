"use client";

import { ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import { searchHelp, type HelpSearchItem } from "@/content/search";
import { cn } from "@/lib/cn";

/**
 * Buscador del centro de ayuda (el único client component de /ayuda): el
 * protagonista de la página. Filtra en el navegador por título y
 * descripción. `hero` va arriba del buscador, dentro de la misma banda;
 * con la búsqueda vacía se muestran `children` (las secciones, renderizadas
 * en el servidor) y, con texto, los resultados.
 */
export function HelpSearch({
  items,
  hero,
  suggestions = [],
  children,
}: {
  items: readonly HelpSearchItem[];
  hero?: ReactNode;
  /** Búsquedas de ejemplo como chips (tocarlas completa el buscador). */
  suggestions?: readonly string[];
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchHelp(items, query), [items, query]);
  const searching = query.trim().length > 0;

  return (
    <div>
      <section className="relative">
        {hero}
        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mt-8 max-w-[680px]">
          <label htmlFor={inputId} className="sr-only">
            Buscar en la ayuda
          </label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-eco-ink text-white">
              <Search className="size-5" strokeWidth={2} />
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Buscá: transferencia, CSV, zonas de envío…"
              autoComplete="off"
              className="h-16 w-full rounded-full border-2 border-adm-input-border bg-adm-surface pr-14 pl-16 text-[17px] text-adm-fg shadow-[0_24px_48px_-32px_rgb(16_22_47/0.45)] transition-[border-color,box-shadow] duration-[240ms] ease-eco-out placeholder:text-adm-fg-muted hover:border-eco-ink focus:outline-none focus-visible:border-adm-link focus-visible:shadow-[var(--adm-focus)] [&::-webkit-search-cancel-button]:hidden"
            />
            {searching ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Borrar la búsqueda"
                className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-adm-fg-muted hover:bg-eco-niebla-2 hover:text-adm-fg"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
          {suggestions.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-adm-fg-muted">Lo más buscado:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuery(s);
                    inputRef.current?.focus();
                  }}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-full border px-3.5 font-medium transition-colors duration-[140ms] pointer-coarse:min-h-11",
                    query.trim().toLowerCase() === s.toLowerCase()
                      ? "border-eco-ink bg-eco-ink text-white"
                      : "border-eco-line bg-adm-surface text-adm-fg hover:border-eco-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </form>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {searching ? (results.length === 1 ? "1 artículo encontrado" : `${results.length} artículos encontrados`) : ""}
      </p>

      {searching ? (
        <section aria-label="Resultados de la búsqueda" className="mt-12 min-h-[40dvh]">
          {results.length ? (
            <>
              <p className="text-[14px] text-adm-fg-muted">
                <span className="tnum font-semibold text-adm-fg">{results.length === 1 ? "1 artículo" : `${results.length} artículos`}</span> para «
                {query.trim()}»
              </p>
              <ol className="mt-4 grid max-w-[880px] gap-3">
                {results.map((a, i) => (
                  <li key={a.slug} className="eco-pop" style={{ ["--i" as string]: Math.min(i, 6) }}>
                    <Link href={`/ayuda/${a.slug}`} className="site-lift group flex items-center gap-5 border border-eco-line bg-adm-surface px-5 py-4 sm:px-6">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold tracking-[0.06em] text-eco-pomelo-ink uppercase">{a.section}</span>
                        <span className="mt-1 block text-[17px] leading-snug font-semibold text-adm-fg">{a.title}</span>
                        <span className="mt-1 block text-[14px] leading-relaxed text-adm-fg-muted">{a.description}</span>
                      </span>
                      <span className="hidden shrink-0 text-[13px] text-adm-fg-muted sm:block">{a.readingMinutes} min</span>
                      <span aria-hidden className="site-arrow flex size-9 shrink-0 items-center justify-center rounded-full bg-eco-niebla-2 text-eco-ink">
                        <ArrowRight className="size-4" strokeWidth={2} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="eco-bubble max-w-[620px] bg-eco-durazno px-6 py-6 text-[15px] leading-relaxed text-eco-ink [--eco-bubble-r:24px]">
              <p>
                No encontramos nada con «{query.trim()}». Probá con otra palabra, mirá las secciones o{" "}
                <Link href="/contacto" className="font-semibold underline decoration-2 underline-offset-4">
                  escribinos
                </Link>
                .
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-eco-ink px-5 text-[14px] font-semibold text-white"
              >
                Ver todas las secciones
              </button>
            </div>
          )}
        </section>
      ) : (
        children
      )}
    </div>
  );
}
