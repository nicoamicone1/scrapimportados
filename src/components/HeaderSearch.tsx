"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { formatPrice } from "../lib/format";
import {
  highlight,
  searchWithCount,
  tokenize,
  type SearchEntry,
} from "../lib/search";
import ProductImage from "./ProductImage";

/** Mínimo de caracteres para disparar la búsqueda. */
const MIN_CHARS = 2;
/** Máximo de productos en el desplegable. */
const MAX_RESULTS = 8;
const DEBOUNCE_MS = 150;

/**
 * Índice liviano generado en build por `src/app/search-index.json/route.ts`
 * (~130 KB, sólo campos públicos + precio FINAL). Se baja una sola vez por
 * sesión, la primera vez que alguien toca el buscador.
 */
const INDEX_URL = "/search-index.json";

let cache: SearchEntry[] | null = null;
let inflight: Promise<SearchEntry[]> | null = null;

function loadIndex(): Promise<SearchEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(INDEX_URL)
      .then((res) => (res.ok ? (res.json() as Promise<SearchEntry[]>) : []))
      .then((data) => {
        cache = Array.isArray(data) ? data : [];
        return cache;
      })
      .catch(() => {
        // Si falla, el submit sigue llevando a /productos/?q=...
        inflight = null;
        return [];
      });
  }
  return inflight;
}

function productHref(slug: string) {
  return `/producto/${slug}/`;
}

function resultsHref(query: string) {
  return `/productos/?q=${encodeURIComponent(query)}`;
}

/**
 * Buscador del header con desplegable en vivo.
 *
 * El índice se genera en build y se baja perezosamente al enfocar el input
 * (una sola vez por sesión); el filtrado es en memoria, con el mismo matcher
 * que usa `/productos` (`src/lib/search.ts`).
 */
export default function HeaderSearch() {
  const router = useRouter();
  const [index, setIndex] = useState<SearchEntry[]>(() => cache ?? []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Debounce: no recalcular en cada tecla. Al refrescarse los resultados se
  // suelta la fila activa (los índices anteriores ya no significan nada).
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query);
      setActive(-1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const term = debounced.trim();
  const enabled = term.length >= MIN_CHARS;

  const { results, count } = useMemo(
    () =>
      enabled
        ? searchWithCount(index, term, MAX_RESULTS)
        : { results: [] as SearchEntry[], count: 0 },
    [enabled, index, term],
  );

  const tokens = useMemo(() => (enabled ? tokenize(term) : []), [enabled, term]);

  /** Filas navegables: los productos + la fila "Ver todos". */
  const rows = results.length + (count > 0 ? 1 : 0);
  const showPanel = open && enabled;

  // Click afuera: cerrar.
  useEffect(() => {
    if (!showPanel) return;
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [showPanel]);

  // Mantener visible la fila activa al moverse con las flechas.
  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(`${listId}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  /** Baja el índice la primera vez que alguien usa el buscador. */
  function ensureIndex() {
    if (cache) {
      if (index.length === 0) setIndex(cache);
      return;
    }
    setLoading(true);
    void loadIndex().then((data) => {
      setIndex(data);
      setLoading(false);
    });
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function goToResults() {
    const q = query.trim();
    close();
    inputRef.current?.blur();
    router.push(q ? resultsHref(q) : "/productos/");
  }

  function goToProduct(slug: string) {
    close();
    inputRef.current?.blur();
    router.push(productHref(slug));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active >= 0 && active < results.length) {
      goToProduct(results[active].slug);
      return;
    }
    goToResults();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (!showPanel || rows === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1 >= rows ? 0 : i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? rows - 1 : i - 1));
    }
  }

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <form onSubmit={handleSubmit} role="search">
        <label className="relative block">
          <span className="sr-only">Buscar productos</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              ensureIndex();
            }}
            onFocus={() => {
              setOpen(true);
              ensureIndex();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar productos…"
            autoComplete="off"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-opt-${active}` : undefined
            }
            className="w-full rounded-full border border-white/20 bg-white py-2 pl-9 pr-3 text-sm text-ink shadow-sm outline-none placeholder:text-muted focus:ring-4 focus:ring-white/25 sm:py-2.5"
          />
        </label>
      </form>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          {loading && index.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted">
              Buscando…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted">
              No encontramos productos para{" "}
              <span className="font-semibold text-ink">{`“${term}”`}</span>.
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label="Resultados de la búsqueda"
              className="max-h-[min(70vh,26rem)] overflow-y-auto"
            >
              {results.map((item, i) => (
                <li
                  key={item.id}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                >
                  <Link
                    href={productHref(item.slug)}
                    onClick={close}
                    onMouseEnter={() => setActive(i)}
                    className={[
                      "flex items-center gap-3 border-b border-line px-3 py-2 transition",
                      active === i ? "bg-brand-50" : "hover:bg-brand-50/60",
                    ].join(" ")}
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-tint p-1">
                      <ProductImage src={item.image} alt="" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-[13px] font-semibold text-ink">
                        {highlight(item.name, tokens).map((part, j) =>
                          part.hit ? (
                            <mark
                              key={j}
                              className="bg-accent-100 text-accent-800"
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span key={j}>{part.text}</span>
                          ),
                        )}
                      </span>
                      <span className="block font-mono text-[10px] text-muted">
                        SKU {item.sku}
                      </span>
                    </span>

                    <span className="shrink-0 whitespace-nowrap text-sm font-extrabold tabular-nums text-accent-700">
                      {formatPrice(item.priceEfectivo)}
                    </span>
                  </Link>
                </li>
              ))}

              <li
                id={`${listId}-opt-${results.length}`}
                role="option"
                aria-selected={active === results.length}
              >
                <Link
                  href={resultsHref(term)}
                  onClick={close}
                  onMouseEnter={() => setActive(results.length)}
                  className={[
                    "block px-3 py-2.5 text-center text-xs font-bold text-brand-700 transition",
                    active === results.length
                      ? "bg-brand-50"
                      : "hover:bg-brand-50/60",
                  ].join(" ")}
                >
                  Ver todos los resultados ({count})
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
