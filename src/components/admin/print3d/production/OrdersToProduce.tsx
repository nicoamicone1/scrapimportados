"use client";

import { ListPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { queueOrder } from "@/app/admin/(panel)/taller-3d/cola/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatGrams, formatMinutes } from "@/lib/admin/print3d-production-utils";
import type { CatalogRef, OrderToProduce } from "@/lib/admin/print3d-production";

import { Swatch } from "./bits";

/**
 * "Pedidos por producir": pedidos en curso con productos que se imprimen y
 * todavía sin trabajos. "Mandar a la cola" crea un trabajo por plato.
 */
export function OrdersToProduce({ orders, catalog }: { orders: OrderToProduce[]; catalog: CatalogRef }) {
  if (!orders.length) return null;
  return (
    <section aria-labelledby="to-produce" className="mb-5 rounded-adm-lg border border-adm-border bg-adm-surface">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-adm-border px-4 py-3">
        <h2 id="to-produce" className="text-[15px] font-semibold">
          Pedidos por producir
        </h2>
        <p className="text-[13px] text-adm-fg-muted">
          {orders.length} {orders.length === 1 ? "pedido tiene" : "pedidos tienen"} piezas del catálogo que todavía no están en la cola.
        </p>
      </header>
      <ul className="divide-y divide-adm-border">
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} catalog={catalog} />
        ))}
      </ul>
    </section>
  );
}

function OrderRow({ order, catalog }: { order: OrderToProduce; catalog: CatalogRef }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const plates = order.items.reduce((s, i) => s + i.plates, 0);
  const minutes = order.items.reduce((s, i) => s + i.minutes, 0);

  const send = async () => {
    setPending(true);
    const res = await queueOrder({ orderId: order.id });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`#${order.number}: ${res.data.created} ${res.data.created === 1 ? "trabajo" : "trabajos"} en "Sin asignar".`);
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/admin/pedidos/${order.id}`} className="tnum font-semibold text-adm-link hover:underline">
            #{order.number}
          </Link>
          <span className="truncate">{order.customer_name}</span>
          {order.payment_status === "paid" ? <Badge tone="green">Pagado</Badge> : null}
        </div>
        <ul className="mt-1 space-y-0.5 text-[13px] text-adm-fg-muted">
          {order.items.map((i) => {
            const color = i.color_id ? catalog.colors.find((c) => c.id === i.color_id) : undefined;
            return (
              <li key={i.id} className="flex items-center gap-1.5">
                <Swatch hex={color?.hex} size={12} />
                <span className="truncate text-adm-fg">
                  {i.name}
                  {i.variant_title ? ` · ${i.variant_title}` : ""}
                </span>
                <span className="tnum shrink-0">
                  × {i.qty} · {i.plates} {i.plates === 1 ? "plato" : "platos"} · {formatGrams(i.grams)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <span className="tnum text-xs text-adm-fg-muted">
          {plates} {plates === 1 ? "trabajo" : "trabajos"} · {formatMinutes(minutes)}
        </span>
        <Button variant="primary" size="sm" icon={<ListPlus />} onClick={send} loading={pending} className="ml-auto h-10 sm:h-7">
          Mandar a la cola
        </Button>
      </div>
    </li>
  );
}
