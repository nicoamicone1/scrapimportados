"use client";

import { useCallback } from "react";

import { Select } from "@/components/ui/Input";
import { useUrlTransition } from "@/components/ui/useUrlTransition";
import { cn } from "@/lib/cn";

/**
 * Lee/escribe filtros en la URL (resetea `?page`). Usa `useUrlTransition`:
 * mientras llega el resultado, las `<Table>` de la página muestran el overlay.
 */
export function useUrlFilters() {
  const { searchParams, setParams, replace, pending } = useUrlTransition();

  const set = useCallback((patch: Record<string, string | null>) => setParams(patch), [setParams]);

  const clear = useCallback(
    (keep: string[] = []) => {
      const params = new URLSearchParams();
      for (const k of keep) {
        const v = searchParams.get(k);
        if (v) params.set(k, v);
      }
      replace(params);
    },
    [replace, searchParams],
  );

  return { get: (k: string) => searchParams.get(k) ?? "", set, clear, pending };
}

/** Select 32px que escribe `?<param>=`. */
export function UrlSelect({
  param,
  label,
  options,
  placeholder,
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
}) {
  const { get, set, pending } = useUrlFilters();
  const value = get(param);
  return (
    <Select
      size="sm"
      aria-label={label}
      value={value}
      onChange={(e) => set({ [param]: e.target.value || null })}
      className={cn(
        "w-full transition-opacity sm:w-auto sm:min-w-40",
        value && "[&_select]:border-adm-accent [&_select]:font-medium",
        pending && "opacity-70",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
