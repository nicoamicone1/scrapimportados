"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";

import { searchHelp, type HelpSearchItem } from "@/content/search";

/**
 * Buscador del centro de ayuda (el único client component de /ayuda):
 * filtra en el navegador por título y descripción. Con la búsqueda vacía
 * muestra `children` (las secciones, renderizadas en el servidor).
 */
export function HelpSearch({ items, children }: { items: readonly HelpSearchItem[]; children: ReactNode }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const results = useMemo(() => searchHelp(items, query), [items, query]);
  const searching = query.trim().length > 0;

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="max-w-[560px]">
        <label htmlFor={inputId} className="text-[13px] font-medium">
          Buscar en la ayuda
        </label>
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-adm-fg-muted" strokeWidth={1.5} aria-hidden />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            placeholder="Ej.: transferencia, CSV, zonas de envío"
            autoComplete="off"
            className="h-11 w-full rounded-adm border border-adm-input-border bg-adm-surface pr-3 pl-10 text-[15px] text-adm-fg placeholder:text-adm-fg-muted/70 hover:border-adm-input-border-hover focus:outline-none focus-visible:shadow-[var(--adm-focus)]"
          />
        </div>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {searching ? (results.length === 1 ? "1 artículo encontrado" : `${results.length} artículos encontrados`) : ""}
      </p>

      {searching ? (
        <section aria-label="Resultados de la búsqueda" className="mt-8">
          {results.length ? (
            <>
              <p className="text-[13px] text-adm-fg-muted">
                {results.length === 1 ? "1 artículo" : `${results.length} artículos`} para «{query.trim()}»
              </p>
              <ol className="mt-3 max-w-[760px] border-b border-adm-border">
                {results.map((a) => (
                  <li key={a.slug} className="border-t border-adm-border py-4">
                    <Link href={`/ayuda/${a.slug}`} className="text-[16px] font-medium text-adm-fg underline-offset-4 hover:text-adm-accent hover:underline">
                      {a.title}
                    </Link>
                    <p className="mt-1 text-[14px] leading-relaxed text-adm-fg-muted">{a.description}</p>
                    <p className="mt-1 text-[12px] text-adm-fg-muted">
                      {a.section} · {a.readingMinutes} min
                    </p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="max-w-[560px] text-[15px] leading-relaxed">
              No encontramos nada con «{query.trim()}». Probá con otra palabra, mirá las secciones o{" "}
              <Link href="/contacto" className="text-adm-accent underline underline-offset-2">
                escribinos
              </Link>
              .
              <button type="button" onClick={() => setQuery("")} className="mt-3 block text-[14px] font-medium text-adm-accent underline underline-offset-2">
                Ver todas las secciones
              </button>
            </p>
          )}
        </section>
      ) : (
        children
      )}
    </div>
  );
}
