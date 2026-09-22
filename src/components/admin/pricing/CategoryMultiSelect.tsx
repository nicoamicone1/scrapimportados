"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/cn";
import { categoryDescendants, categoryTree, type CategoryLite } from "@/lib/pricing";

export interface CategoryMultiSelectProps {
  categories: CategoryLite[];
  value: string[];
  onChange: (ids: string[]) => void;
  /**
   * Al tildar una categoría se tildan también sus subcategorías (y al
   * destildarla, se destildan). Útil para promos y cupones, que comparan
   * contra las categorías asignadas a cada producto.
   */
  cascade?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
}

/** Lista de categorías con sangría por nivel, búsqueda y selección múltiple. */
export function CategoryMultiSelect({ categories, value, onChange, cascade = false, invalid, id, ...aria }: CategoryMultiSelectProps) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => categoryTree(categories), [categories]);
  const selected = useMemo(() => new Set(value), [value]);
  const term = q.trim().toLowerCase();
  const visible = term ? rows.filter((r) => r.path.toLowerCase().includes(term)) : rows;

  const toggle = (catId: string, checked: boolean) => {
    const next = new Set(selected);
    const ids = cascade ? [catId, ...categoryDescendants(categories, catId)] : [catId];
    for (const i of ids) {
      if (checked) next.add(i);
      else next.delete(i);
    }
    // Conserva el orden del árbol.
    onChange(rows.filter((r) => next.has(r.id)).map((r) => r.id));
  };

  return (
    <div
      id={id}
      aria-describedby={aria["aria-describedby"]}
      className={cn("rounded-adm border bg-adm-surface", invalid ? "border-adm-danger" : "border-adm-input-border")}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-adm-border p-2">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar categoría…" className="sm:w-60" aria-label="Buscar categoría" />
        <span className="tnum text-[13px] text-adm-fg-muted">
          {value.length === 0 ? "Ninguna elegida" : value.length === 1 ? "1 elegida" : `${value.length} elegidas`}
        </span>
        {value.length ? (
          <Button size="sm" variant="ghost" onClick={() => onChange([])} className="ml-auto">
            Limpiar
          </Button>
        ) : null}
      </div>
      <ul role="group" aria-label="Categorías" className="adm-scroll max-h-64 overflow-y-auto py-1">
        {visible.length === 0 ? (
          <li className="px-3 py-2 text-[13px] text-adm-fg-muted">No hay categorías con ese nombre.</li>
        ) : (
          visible.map((row) => (
            <li key={row.id}>
              <label
                className="flex h-8 cursor-pointer items-center gap-2 pr-3 text-sm hover:bg-adm-hover"
                style={{ paddingLeft: `${12 + (term ? 0 : row.depth * 18)}px` }}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-[var(--adm-accent)]"
                  checked={selected.has(row.id)}
                  onChange={(e) => toggle(row.id, e.target.checked)}
                />
                <span className={cn("truncate", row.depth === 0 && "font-medium")}>{term ? row.path : row.name}</span>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
