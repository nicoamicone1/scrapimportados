"use client";

import { Suspense, useCallback, useMemo, useState } from "react";

import type { CatalogItem, Category } from "../lib/products";
import { haystackOf, scoreHaystack, tokenize, type Haystack } from "../lib/search";
import ProductCard from "./ProductCard";
import UrlSync from "./UrlSync";

type SortKey = "nombre" | "precio-asc" | "precio-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
];

const FIELD =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

const LABEL =
  "mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted";

export default function CatalogClient({
  products,
  categories,
}: {
  products: CatalogItem[];
  /** Ya vienen sin la categoría basura (ver `getUsedCategories`). */
  categories: Category[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sort, setSort] = useState<SortKey>("nombre");

  // Estable: `UrlSync` la usa como dependencia de sus efectos.
  const applyParams = useCallback((q: string, cat: string) => {
    setQuery(q);
    setCategory(cat);
  }, []);

  /** Nombre + SKU normalizados una sola vez (mismo matcher que el header). */
  const haystacks = useMemo(
    () => new Map<number, Haystack>(products.map((p) => [p.id, haystackOf(p)])),
    [products],
  );

  const visible = useMemo(() => {
    const tokens = tokenize(query);

    const filtered = products.filter((p) => {
      if (onlyInStock && !p.inStock) return false;
      if (category !== "todas" && !p.categories.some((c) => c.slug === category))
        return false;
      if (tokens.length > 0) {
        const hay = haystacks.get(p.id);
        if (!hay || scoreHaystack(hay, tokens) === 0) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "precio-asc":
          return a.prices.efectivo.final - b.prices.efectivo.final;
        case "precio-desc":
          return b.prices.efectivo.final - a.prices.efectivo.final;
        default:
          return a.name.localeCompare(b.name, "es-AR");
      }
    });
    return sorted;
  }, [products, haystacks, query, category, onlyInStock, sort]);

  const hasFilters =
    query.trim() !== "" || category !== "todas" || onlyInStock || sort !== "nombre";

  function resetFilters() {
    setQuery("");
    setCategory("todas");
    setOnlyInStock(false);
    setSort("nombre");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lee/escribe ?q= y ?cat= (necesita Suspense en el export estático). */}
      <Suspense fallback={null}>
        <UrlSync query={query} category={category} onParams={applyParams} />
      </Suspense>

      {/* Barra de filtros: tarjeta pegajosa debajo del header */}
      <div className="sticky top-14 z-20 -mx-4 border-y border-line bg-white/95 px-4 py-3 shadow-card backdrop-blur sm:top-16 sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="sr-only">Buscar producto</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o código (SKU)…"
              className={FIELD}
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className={LABEL}>Categoría</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={FIELD}
              >
                <option value="todas">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={LABEL}>Ordenar por</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className={FIELD}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <label className="flex w-full cursor-pointer select-none items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-soft transition hover:border-brand-300">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-brand-600"
                />
                Solo con stock
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>
              <span className="font-bold text-ink tabular-nums">
                {visible.length}
              </span>{" "}
              {visible.length === 1 ? "producto" : "productos"} de{" "}
              <span className="tabular-nums">{products.length}</span>
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-bold text-brand-700 underline underline-offset-4 transition hover:text-brand-900"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grilla */}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          No se encontraron productos con esos criterios.
        </p>
      ) : (
        <ul className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
