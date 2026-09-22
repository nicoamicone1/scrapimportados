"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { searchProducts } from "@/app/admin/(panel)/precios/actions";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import type { PickerProduct } from "@/lib/admin/pricing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { Thumb } from "./shared";

export interface ProductMultiPickerProps {
  value: PickerProduct[];
  onChange: (products: PickerProduct[]) => void;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
}

/** Selector de productos con búsqueda por nombre o SKU (server action). */
export function ProductMultiPicker({ value, onChange, invalid, id, ...aria }: ProductMultiPickerProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const selectedIds = new Set(value.map((p) => p.id));

  useEffect(() => {
    const current = ++reqId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchProducts(q);
      if (current !== reqId.current) return;
      setLoading(false);
      if (res.ok) {
        setResults(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const add = (p: PickerProduct) => {
    if (!selectedIds.has(p.id)) onChange([...value, p]);
  };
  const remove = (pid: string) => onChange(value.filter((p) => p.id !== pid));

  return (
    <div
      id={id}
      aria-describedby={aria["aria-describedby"]}
      className={cn("grid gap-3 rounded-adm border bg-adm-surface p-2 md:grid-cols-2", invalid ? "border-adm-danger" : "border-adm-input-border")}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o SKU…" className="sm:w-full" aria-label="Buscar productos" />
          {loading ? <Loader2 className="size-4 animate-spin text-adm-fg-muted" aria-label="Buscando" /> : null}
        </div>
        <ul aria-label="Resultados" className="adm-scroll mt-2 max-h-72 overflow-y-auto">
          {error ? <li className="px-2 py-2 text-[13px] text-adm-danger">{error}</li> : null}
          {!error && !loading && results.length === 0 ? (
            <li className="px-2 py-2 text-[13px] text-adm-fg-muted">No encontramos productos con esa búsqueda.</li>
          ) : null}
          {results.map((p) => {
            const picked = selectedIds.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={picked}
                  className="flex h-10 w-full items-center gap-2 rounded-adm px-2 text-left text-[13px] hover:bg-adm-hover disabled:cursor-default disabled:opacity-60"
                >
                  <Thumb url={p.imageUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-adm-fg">{p.name}</span>
                    <span className="block truncate font-mono text-xs text-adm-fg-muted">{p.sku ?? "Sin SKU"}</span>
                  </span>
                  <span className="tnum text-adm-fg-muted">{p.price == null ? "" : formatMoney(p.price)}</span>
                  {picked ? (
                    <span className="text-xs text-adm-fg-muted">Elegido</span>
                  ) : (
                    <Plus className="size-4 text-adm-fg-muted" aria-label="Agregar" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-w-0 border-t border-adm-border pt-2 md:border-t-0 md:border-l md:pt-0 md:pl-3">
        <div className="flex h-8 items-center justify-between">
          <span className="text-[13px] font-medium">
            {value.length === 0 ? "Ningún producto elegido" : value.length === 1 ? "1 producto elegido" : `${value.length} productos elegidos`}
          </span>
          {value.length ? (
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Quitar todos
            </Button>
          ) : null}
        </div>
        <ul aria-label="Productos elegidos" className="adm-scroll mt-2 max-h-72 overflow-y-auto">
          {value.map((p) => (
            <li key={p.id} className="flex h-10 items-center gap-2 px-1 text-[13px]">
              <Thumb url={p.imageUrl} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label={`Quitar ${p.name}`}
                className="inline-flex size-7 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
