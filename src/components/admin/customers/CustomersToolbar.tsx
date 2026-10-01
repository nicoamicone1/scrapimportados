"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
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

/** Búsqueda + orden del listado de clientes (en la URL), con la etiqueta activa como chip que se saca de un toque. */
export function CustomersToolbar() {
  const { searchParams: params, setParams, pending } = useUrlTransition();
  const tag = params.get("tag");

  const setSort = (value: string) => setParams({ orden: value && value !== "recientes" ? value : null });

  return (
    <div className="mb-3 grid grid-cols-1 items-center gap-2 sm:flex sm:flex-wrap">
      <SearchInput placeholder="Nombre, email, teléfono o DNI" aria-label="Buscar clientes" className="[&_input]:max-sm:h-11" />
      <Select
        size="sm"
        aria-label="Orden"
        className={cn("transition-opacity sm:w-40 max-sm:h-11", pending && "opacity-70")}
        value={params.get("orden") ?? "recientes"}
        onChange={(e) => setSort(e.target.value)}
        options={SORTS}
      />
      {tag ? (
        <Button size="sm" className="max-sm:h-11" iconRight={<X />} onClick={() => setParams({ tag: null })} aria-label={`Sacar la etiqueta ${tag}`}>
          Etiqueta: {tag}
        </Button>
      ) : null}
    </div>
  );
}
