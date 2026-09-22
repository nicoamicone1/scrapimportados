"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

/** Select de orden: navega al cambiar (cada opción ya trae su URL armada en el server). */
export function SortSelect({ options, value }: { options: { value: string; label: string; href: string }[]; value: string }) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="sr-only text-sm whitespace-nowrap text-fg-muted sm:not-sr-only">
        Ordenar por
      </label>
      <select
        id={id}
        className="input min-h-10 w-auto max-w-[11rem] py-0 sm:max-w-none"
        value={value}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value);
          if (opt) router.push(opt.href, { scroll: false });
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
