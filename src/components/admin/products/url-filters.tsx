"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/** Lee/escribe filtros en la URL (resetea `?page`). */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete("page");
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(
    (keep: string[] = []) => {
      const params = new URLSearchParams();
      for (const k of keep) {
        const v = searchParams.get(k);
        if (v) params.set(k, v);
      }
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams],
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
  const { get, set } = useUrlFilters();
  const value = get(param);
  return (
    <Select
      size="sm"
      aria-label={label}
      value={value}
      onChange={(e) => set({ [param]: e.target.value || null })}
      className={cn("w-full sm:w-auto sm:min-w-40", value && "[&_select]:border-adm-accent [&_select]:font-medium", className)}
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
