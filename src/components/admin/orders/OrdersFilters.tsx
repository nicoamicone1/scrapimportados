"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_STATUS_LABELS } from "@/lib/admin/order-utils";
import { cn } from "@/lib/cn";

const SORTS = [
  { value: "recientes", label: "Más recientes" },
  { value: "antiguos", label: "Más antiguos" },
  { value: "total-desc", label: "Mayor total" },
  { value: "total-asc", label: "Menor total" },
];

const FILTER_KEYS = ["q", "estado", "pago", "metodo", "entrega", "desde", "hasta", "orden"];

/** Barra de filtros del listado de pedidos (todo en la URL, resuelto en el server). */
export function OrdersFilters({ methods }: { methods: { code: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Remonta el buscador al limpiar (su texto es estado interno).
  const [resetKey, setResetKey] = useState(0);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const clear = () => {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.delete("page");
    const qs = next.toString();
    setResetKey((k) => k + 1);
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const active = FILTER_KEYS.some((k) => k !== "orden" && params.get(k));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-70")} aria-busy={pending || undefined}>
      <SearchInput key={resetKey} placeholder="Número, cliente, email, teléfono o SKU" aria-label="Buscar pedidos" />
      <Select
        size="sm"
        aria-label="Estado"
        value={params.get("estado") ?? ""}
        onChange={(e) => set("estado", e.target.value)}
        className="w-40"
        options={[{ value: "", label: "Todos los estados" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))]}
      />
      <Select
        size="sm"
        aria-label="Pago"
        value={params.get("pago") ?? ""}
        onChange={(e) => set("pago", e.target.value)}
        className="w-40"
        options={[
          { value: "", label: "Todos los pagos" },
          { value: "impago", label: "Sin cobrar (total o parcial)" },
          ...(["pending", "partial", "paid", "refunded"] as const).map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })),
        ]}
      />
      <Select
        size="sm"
        aria-label="Método de pago"
        value={params.get("metodo") ?? ""}
        onChange={(e) => set("metodo", e.target.value)}
        className="w-44"
        options={[{ value: "", label: "Todos los métodos" }, ...methods.map((m) => ({ value: m.code, label: m.name }))]}
      />
      <Select
        size="sm"
        aria-label="Entrega"
        value={params.get("entrega") ?? ""}
        onChange={(e) => set("entrega", e.target.value)}
        className="w-36"
        options={[
          { value: "", label: "Envío y retiro" },
          { value: "envio", label: "Envío" },
          { value: "retiro", label: "Retiro" },
        ]}
      />
      <div className="flex items-center gap-1.5">
        <label htmlFor="f-desde" className="text-[13px] text-adm-fg-muted">
          Desde
        </label>
        <Input
          id="f-desde"
          type="date"
          size="sm"
          className="w-36"
          value={params.get("desde") ?? ""}
          onChange={(e) => set("desde", e.target.value)}
        />
        <label htmlFor="f-hasta" className="text-[13px] text-adm-fg-muted">
          Hasta
        </label>
        <Input
          id="f-hasta"
          type="date"
          size="sm"
          className="w-36"
          value={params.get("hasta") ?? ""}
          onChange={(e) => set("hasta", e.target.value)}
        />
      </div>
      <Select
        size="sm"
        aria-label="Orden"
        value={params.get("orden") ?? "recientes"}
        onChange={(e) => set("orden", e.target.value === "recientes" ? "" : e.target.value)}
        className="w-36"
        options={SORTS}
      />
      {active ? (
        <Button variant="ghost" size="sm" onClick={clear}>
          Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
