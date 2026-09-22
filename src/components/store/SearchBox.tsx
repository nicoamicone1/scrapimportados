"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { track } from "@/lib/store/analytics";

export interface Suggestion {
  slug: string;
  name: string;
  brand: string | null;
  sku: string | null;
  price: number;
  priceVaries: boolean;
  image: string | null;
  available: boolean;
}

interface SearchResponse {
  items: Suggestion[];
  total: number;
}

/**
 * Buscador con desplegable en vivo (`/buscar?q=`): nombre, SKU y marca.
 * Combobox accesible: ↑/↓ recorren, Enter abre, Esc cierra. Enter sin
 * selección va a `/productos?q=`.
 */
export function SearchBox({
  autoFocus,
  className,
  onNavigate,
  variant = "field",
}: {
  autoFocus?: boolean;
  className?: string;
  onNavigate?: () => void;
  /** `field`: input del header; `overlay`: grande, en el panel de búsqueda. */
  variant?: "field" | "overlay";
}) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/buscar?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (res.ok) {
          setData((await res.json()) as SearchResponse);
          setActive(-1);
        }
      } catch {
        // abortado o sin red: se queda con lo anterior
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = q.trim();
  const items = term.length >= 2 ? (data?.items ?? []) : [];
  const showList = open && term.length >= 2 && (items.length > 0 || (!loading && data !== null));

  const go = (href: string) => {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  const submit = () => {
    if (!term) return;
    track("search", { search_term: term });
    go(`/productos?q=${encodeURIComponent(term)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < items.length) go(`/producto/${items[active].slug}`);
      else submit();
    }
  };

  const big = variant === "overlay";

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form
        role="search"
        action="/productos"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar productos
        </label>
        <Search
          aria-hidden
          strokeWidth={1.5}
          className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-muted", big ? "left-3 size-5" : "left-3 size-4")}
        />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar por nombre, marca o código"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          className={cn("input text-fg", big ? "pl-10" : "pl-9", !big && "min-h-[calc(var(--control-h)-4px)]")}
        />
      </form>

      {showList ? (
        <div className="panel-float absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-border">
          <ul id={`${listId}-list`} role="listbox" aria-label="Sugerencias" className="max-h-[60vh] overflow-y-auto py-1">
            {items.map((item, i) => (
              <li
                key={item.slug}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(`/producto/${item.slug}`)}
                className={cn("flex cursor-pointer items-center gap-3 px-3 py-2", i === active && "bg-surface")}
              >
                <span className="relative size-11 shrink-0 overflow-hidden rounded-sm bg-surface">
                  {item.image ? <Image src={item.image} alt="" fill sizes="44px" className="object-contain p-0.5" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm">{item.name}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {[item.brand, item.sku].filter(Boolean).join(" · ")}
                    {!item.available ? (item.brand || item.sku ? " · Sin stock" : "Sin stock") : ""}
                  </span>
                </span>
                <span className="tnum shrink-0 text-sm font-semibold">
                  {item.priceVaries ? <span className="font-normal text-fg-muted">Desde </span> : null}
                  {formatMoney(item.price)}
                </span>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="px-3 py-3 text-sm text-fg-muted" role="presentation">
                No encontramos «{term}». Probá con menos palabras.
              </li>
            ) : null}
          </ul>
          {data && data.total > 0 ? (
            <button
              type="button"
              id={`${listId}-opt-${items.length}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              className={cn("block w-full border-t border-border px-3 py-2.5 text-left text-sm font-medium hover:bg-surface", active === items.length && "bg-surface")}
            >
              Ver los {data.total} resultados
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
