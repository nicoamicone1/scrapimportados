"use client";

import { Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { useUrlTransition } from "@/components/ui/useUrlTransition";
import { cn } from "@/lib/cn";

const SORTS = [
  { value: "recientes", label: "Más recientes" },
  { value: "nombre", label: "Nombre (A-Z)" },
  { value: "pedidos", label: "Más pedidos" },
  { value: "gastado", label: "Más gastado" },
];

/** Búsqueda + orden del listado de clientes (en la URL). */
export function CustomersToolbar() {
  const { searchParams: params, setParams, pending } = useUrlTransition();

  const setSort = (value: string) => setParams({ orden: value && value !== "recientes" ? value : null });

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchInput placeholder="Nombre, email, teléfono o DNI" aria-label="Buscar clientes" />
      <Select
        size="sm"
        aria-label="Orden"
        className={cn("w-40 transition-opacity", pending && "opacity-70")}
        value={params.get("orden") ?? "recientes"}
        onChange={(e) => setSort(e.target.value)}
        options={SORTS}
      />
    </div>
  );
}
