"use client";

import { ChevronDown, Printer, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changeOrderStatus, updateOrderTracking } from "@/app/admin/(panel)/pedidos/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/DropdownMenu";
import {
  canTransition,
  nextStatus,
  ORDER_STATUSES,
  statusActionLabel,
  type OrderStatus,
} from "@/lib/admin/order-utils";

import { CancelDialog, ShipDialog, type ShipValues } from "./OrderDialogs";

export interface OrderHeaderActionsProps {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: string;
  tracking: { carrier: string | null; number: string | null; url: string | null };
}

/**
 * Acciones de estado del detalle: el siguiente paso natural como botón
 * primario y el resto en un menú. Enviar pide seguimiento; cancelar pide
 * motivo (y devuelve stock); reabrir vuelve a descontarlo.
 */
export function OrderHeaderActions({ id, number, status, fulfillment, tracking }: OrderHeaderActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipMode, setShipMode] = useState<"ship" | "edit">("ship");
  const [cancelOpen, setCancelOpen] = useState(false);
  const pickup = fulfillment === "pickup";

  const run = async (to: OrderStatus, extra: { reason?: string } & Partial<ShipValues> = {}) => {
    setBusy(true);
    const res = await changeOrderStatus({ orderId: id, status: to, ...extra });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    const stock = res.data.stockDelta;
    toast.success(
      to === "cancelled"
        ? `Pedido #${number} cancelado.${stock > 0 ? ` Volvieron ${stock} ${stock === 1 ? "unidad" : "unidades"} al stock.` : ""}`
        : to === "pending" && status === "cancelled"
          ? `Pedido #${number} reabierto.`
          : `Pedido #${number} actualizado.`,
    );
    startTransition(() => router.refresh());
    return true;
  };

  const go = (to: OrderStatus) => {
    if (to === "cancelled") setCancelOpen(true);
    else if (to === "shipped" && !pickup) {
      setShipMode("ship");
      setShipOpen(true);
    } else void run(to);
  };

  const saveTracking = async (v: ShipValues) => {
    const res = await updateOrderTracking({ orderId: id, ...v });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success("Seguimiento actualizado.");
    startTransition(() => router.refresh());
    return true;
  };

  const next = nextStatus(status);
  const others = ORDER_STATUSES.filter((s) => s !== next && s !== "cancelled" && canTransition(status, s));
  const loading = busy || pending;

  return (
    <>
      <ButtonLink href={`/admin/pedidos/imprimir?ids=${id}`} external icon={<Printer />}>
        Imprimir remito
      </ButtonLink>

      {status === "cancelled" ? (
        <Button variant="primary" icon={<RotateCcw />} loading={loading} onClick={() => void run("pending")}>
          Reabrir pedido
        </Button>
      ) : (
        <>
          <DropdownMenu
            width={232}
            trigger={
              <Button iconRight={<ChevronDown />} disabled={loading}>
                Más acciones
              </Button>
            }
          >
            {others.length ? <DropdownLabel>Cambiar estado</DropdownLabel> : null}
            {others.map((s) => (
              <DropdownItem key={s} onSelect={() => go(s)}>
                {statusActionLabel(s, fulfillment, status)}
              </DropdownItem>
            ))}
            {!pickup && (status === "shipped" || status === "delivered") ? (
              <>
                <DropdownSeparator />
                <DropdownItem
                  onSelect={() => {
                    setShipMode("edit");
                    setShipOpen(true);
                  }}
                >
                  Editar seguimiento
                </DropdownItem>
              </>
            ) : null}
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => setCancelOpen(true)}>
              Cancelar pedido
            </DropdownItem>
          </DropdownMenu>
          {next ? (
            <Button variant="primary" loading={loading} onClick={() => go(next)}>
              {statusActionLabel(next, fulfillment, status)}
            </Button>
          ) : null}
        </>
      )}

      {shipOpen ? (
        <ShipDialog
          open={shipOpen}
          onOpenChange={setShipOpen}
          title={shipMode === "ship" ? `Despachar el pedido #${number}` : `Seguimiento del pedido #${number}`}
          confirmLabel={shipMode === "ship" ? "Marcar enviado" : "Guardar seguimiento"}
          initial={{
            carrier: tracking.carrier ?? "",
            trackingNumber: tracking.number ?? "",
            trackingUrl: tracking.url ?? "",
          }}
          onConfirm={(v) => (shipMode === "ship" ? run("shipped", v) : saveTracking(v))}
        />
      ) : null}
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancelar el pedido #${number}`}
        confirmLabel="Cancelar pedido"
        onConfirm={(reason) => run("cancelled", { reason })}
      />
    </>
  );
}
