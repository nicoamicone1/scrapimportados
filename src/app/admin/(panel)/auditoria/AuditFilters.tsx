"use client";

import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { useUrlTransition } from "@/components/ui/useUrlTransition";
import { cn } from "@/lib/cn";

const ACTION_LABELS: Record<string, string> = {
  product: "Productos",
  category: "Categorías",
  inventory: "Inventario",
  variant: "Variantes",
  order: "Pedidos",
  customer: "Clientes",
  promotion: "Promociones",
  coupon: "Cupones",
  price: "Precios",
  prices: "Precios",
  page: "Páginas",
  menu: "Menús",
  theme: "Apariencia",
  shipping: "Envíos",
  import: "Importación",
  settings: "Configuración",
  redirect: "Redirecciones",
  user: "Usuarios",
  account: "Mi cuenta",
  export: "Exportaciones",
};

/** Filtros de la auditoría sincronizados con la URL (?usuario=&accion=&entidad=&desde=&hasta=&q=). */
export function AuditFilters({ facets }: { facets: { actors: { id: string; label: string }[]; actions: string[]; entities: string[] } }) {
  const { searchParams, setParams, replace, pending, pathname } = useUrlTransition();

  const setParam = (key: string, value: string) => setParams({ [key]: value || null });

  const get = (k: string) => searchParams.get(k) ?? "";
  const any = ["usuario", "accion", "entidad", "desde", "hasta", "q"].some((k) => searchParams.get(k));

  return (
    <div className={cn("mb-3 flex flex-wrap items-end gap-2 transition-opacity", pending && "opacity-70")} aria-busy={pending || undefined}>
      <SearchInput placeholder="Buscar en el resumen, ID o email" aria-label="Buscar en la auditoría" />
      <Select
        size="sm"
        aria-label="Usuario"
        value={get("usuario")}
        onChange={(e) => setParam("usuario", e.target.value)}
        options={[{ value: "", label: "Todos los usuarios" }, ...facets.actors.map((a) => ({ value: a.id, label: a.label }))]}
        className="w-52"
      />
      <Select
        size="sm"
        aria-label="Acción"
        value={get("accion")}
        onChange={(e) => setParam("accion", e.target.value)}
        options={[
          { value: "", label: "Todas las acciones" },
          ...facets.actions.map((a) => ({ value: a, label: ACTION_LABELS[a] ? `${ACTION_LABELS[a]} (${a}.*)` : `${a}.*` })),
        ]}
        className="w-48"
      />
      <Select
        size="sm"
        aria-label="Entidad"
        value={get("entidad")}
        onChange={(e) => setParam("entidad", e.target.value)}
        options={[{ value: "", label: "Todas las entidades" }, ...facets.entities.map((e) => ({ value: e, label: e }))]}
        className="w-44"
      />
      <label className="flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
        Desde
        <Input type="date" size="sm" value={get("desde")} max={get("hasta") || undefined} onChange={(e) => setParam("desde", e.target.value)} className="w-36" />
      </label>
      <label className="flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
        Hasta
        <Input type="date" size="sm" value={get("hasta")} min={get("desde") || undefined} onChange={(e) => setParam("hasta", e.target.value)} className="w-36" />
      </label>
      {any ? (
        <Button size="sm" variant="ghost" onClick={() => replace(pathname)}>
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
