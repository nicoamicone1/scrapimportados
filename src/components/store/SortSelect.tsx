"use client";

import { useId } from "react";

import { useStorePath } from "@/components/store/StoreBase";
import { useUrlTransition } from "@/components/ui/useUrlTransition";
import { cn } from "@/lib/cn";

/** Select de orden: navega al cambiar (cada opción ya trae su URL armada en el server). */
export function SortSelect({ options, value }: { options: { value: string; label: string; href: string }[]; value: string }) {
  const { push, pending } = useUrlTransition();
  const toPath = useStorePath();
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="sr-only text-sm whitespace-nowrap text-fg-muted sm:not-sr-only">
        Ordenar por
      </label>
      <select
        id={id}
        className={cn("input min-h-10 w-auto max-w-[11rem] py-0 transition-opacity sm:max-w-none", pending && "opacity-60")}
        aria-busy={pending || undefined}
        value={value}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) push(toPath(opt.href));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
