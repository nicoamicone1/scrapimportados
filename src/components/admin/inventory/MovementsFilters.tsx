"use client";

import { X } from "lucide-react";

import { UrlSelect, useUrlFilters } from "@/components/admin/products/url-filters";
import { Button } from "@/components/ui/Button";
import { MOVEMENT_REASON_LABELS, MOVEMENT_REASONS } from "@/lib/schemas/inventory";

const dateClass =
  "h-8 rounded-adm border border-adm-input-border bg-adm-surface px-2 text-sm text-adm-fg hover:border-[#bdb7ab] [color-scheme:light]";

/** Filtros del historial: motivo, rango de fechas y variante (chip). */
export function MovementsFilters({ variantLabel }: { variantLabel: string | null }) {
  const { get, set, clear } = useUrlFilters();
  const hasFilters = Boolean(get("motivo") || get("desde") || get("hasta") || get("variante"));
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {variantLabel ? (
        <span className="inline-flex h-8 max-w-full items-center gap-1 rounded-adm border border-adm-accent bg-adm-surface pr-1 pl-2.5 text-[13px]">
          <span className="truncate">
            Variante: <span className="font-medium">{variantLabel}</span>
          </span>
          <button
            type="button"
            aria-label="Quitar filtro de variante"
            onClick={() => set({ variante: null })}
            className="inline-flex size-6 items-center justify-center rounded-[4px] text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ) : null}
      <UrlSelect
        param="motivo"
        label="Motivo"
        placeholder="Todos los motivos"
        options={MOVEMENT_REASONS.map((r) => ({ value: r, label: MOVEMENT_REASON_LABELS[r] }))}
      />
      <label className="flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
        Desde
        <input
          type="date"
          className={dateClass}
          value={get("desde")}
          max={get("hasta") || undefined}
          onChange={(e) => set({ desde: e.target.value || null })}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
        Hasta
        <input
          type="date"
          className={dateClass}
          value={get("hasta")}
          min={get("desde") || undefined}
          onChange={(e) => set({ hasta: e.target.value || null })}
        />
      </label>
      {hasFilters ? (
        <Button size="sm" variant="ghost" icon={<X />} onClick={() => clear()}>
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
