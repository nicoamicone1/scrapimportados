"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/Input";
import { categoryPath, flattenTree, type CategoryNodeInput } from "@/lib/admin/category-tree";
import { normalizeText } from "@/lib/slug";

/** Árbol de categorías con checkboxes y búsqueda (lateral del form de producto). */
export function CategoryTreeSelect({
  categories,
  value,
  onChange,
}: {
  categories: CategoryNodeInput[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const flat = useMemo(() => flattenTree(categories), [categories]);
  const selected = new Set(value);
  const term = normalizeText(q);
  const rows = term
    ? flat
        .filter((f) => normalizeText(f.item.name).includes(term))
        .map((f) => ({ ...f, depth: 0, label: categoryPath(categories, f.id) }))
    : flat.map((f) => ({ ...f, label: f.item.name }));

  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  if (!categories.length) {
    return <p className="text-[13px] text-adm-fg-muted">Todavía no hay categorías. Creá la primera en Categorías.</p>;
  }

  return (
    <div className="rounded-adm border border-adm-input-border">
      <div className="relative border-b border-adm-border">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-adm-fg-muted" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar categoría"
          aria-label="Buscar categoría"
          className="h-8 w-full rounded-t-adm bg-transparent pr-2 pl-8 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      <ul className="adm-scroll max-h-64 overflow-y-auto py-1" aria-label="Categorías">
        {rows.length === 0 ? <li className="px-3 py-2 text-[13px] text-adm-fg-muted">Sin resultados.</li> : null}
        {rows.map((r) => (
          <li key={r.id} style={{ paddingLeft: 8 + r.depth * 18 }} className="pr-2 hover:bg-adm-hover">
            <Checkbox
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              label={<span className="text-[13px]">{r.label}</span>}
              className="py-1"
            />
          </li>
        ))}
      </ul>
      {value.length ? (
        <div className="flex items-center justify-between border-t border-adm-border px-2.5 py-1.5 text-xs text-adm-fg-muted">
          <span className="tnum">
            {value.length} elegida{value.length === 1 ? "" : "s"}
          </span>
          <button type="button" className="hover:text-adm-fg hover:underline" onClick={() => onChange([])}>
            Quitar todas
          </button>
        </div>
      ) : null}
    </div>
  );
}
