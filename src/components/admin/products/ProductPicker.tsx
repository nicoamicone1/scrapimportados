"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { ProductSummary } from "@/lib/admin/products";

import { searchProducts } from "@/app/admin/(panel)/productos/actions";

import { Thumb } from "./Thumb";

/**
 * Buscador de productos en un dialog. `multiple` con tope `max`; sin
 * `multiple`, elegir una fila confirma directamente.
 */
export function ProductPicker({
  open,
  onOpenChange,
  title,
  description,
  excludeIds = [],
  multiple = false,
  max = 8,
  confirmLabel = "Agregar",
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  excludeIds?: string[];
  multiple?: boolean;
  max?: number;
  confirmLabel?: string;
  onPick: (items: ProductSummary[]) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ProductSummary[]>([]);
  const seq = useRef(0);
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    if (!open) return;
    const current = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchProducts(q, excludeKey ? excludeKey.split(",") : []);
      if (current !== seq.current) return;
      setLoading(false);
      if (res.ok) {
        setItems(res.data.items);
        setError(null);
      } else setError(res.error);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open, excludeKey]);

  const close = (next: boolean) => {
    if (!next) {
      setPicked([]);
      setQ("");
    }
    onOpenChange(next);
  };

  const isPicked = (id: string) => picked.some((p) => p.id === id);
  const choose = (item: ProductSummary) => {
    if (!multiple) {
      onPick([item]);
      close(false);
      return;
    }
    setPicked((prev) => (isPicked(item.id) ? prev.filter((p) => p.id !== item.id) : prev.length >= max ? prev : [...prev, item]));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="lg"
      title={title}
      description={description}
      footer={
        multiple ? (
          <>
            <span className="tnum mr-auto text-[13px] text-adm-fg-muted">
              {picked.length} de {max} elegidos
            </span>
            <Button onClick={() => close(false)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!picked.length}
              onClick={() => {
                onPick(picked);
                close(false);
              }}
            >
              {confirmLabel}
            </Button>
          </>
        ) : undefined
      }
    >
      <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o SKU" className="sm:w-full" autoFocus />
      <div className="mt-3 min-h-64">
        {error ? <p className="text-[13px] text-adm-danger">{error}</p> : null}
        {loading && !items.length ? (
          <p className="flex items-center gap-2 text-[13px] text-adm-fg-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando…
          </p>
        ) : null}
        {!loading && !items.length && !error ? <p className="text-[13px] text-adm-fg-muted">No encontramos productos con esa búsqueda.</p> : null}
        <ul className={cn("divide-y divide-adm-border", loading && "opacity-60")}>
          {items.map((item) => {
            const active = isPicked(item.id);
            const disabled = multiple && !active && picked.length >= max;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => choose(item)}
                  disabled={disabled}
                  aria-pressed={multiple ? active : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-1.5 py-1.5 text-left hover:bg-adm-hover disabled:opacity-50",
                    active && "bg-adm-surface-2",
                  )}
                >
                  <Thumb url={item.image_url} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    <span className="block truncate font-mono text-xs text-adm-fg-muted">{item.sku ?? "Sin SKU"}</span>
                  </span>
                  {item.status !== "active" ? <StatusBadge kind="product" value={item.status} /> : null}
                  {multiple ? (
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[3px] border",
                        active ? "border-adm-accent bg-adm-accent text-white" : "border-adm-input-border",
                      )}
                    >
                      {active ? <Check className="size-3" /> : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
