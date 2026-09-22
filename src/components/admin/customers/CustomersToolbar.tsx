"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";

const SORTS = [
  { value: "recientes", label: "Más recientes" },
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "pedidos", label: "Más pedidos" },
  { value: "gastado", label: "Más gastado" },
];

/** Búsqueda + orden del listado de clientes (en la URL). */
export function CustomersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const setSort = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "recientes") next.set("orden", value);
    else next.delete("orden");
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchInput placeholder="Nombre, email, teléfono o DNI" aria-label="Buscar clientes" />
      <Select
        size="sm"
        aria-label="Orden"
        className="w-40"
        value={params.get("orden") ?? "recientes"}
        onChange={(e) => setSort(e.target.value)}
        options={SORTS}
      />
    </div>
  );
}
