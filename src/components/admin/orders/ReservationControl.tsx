"use client";

import { CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { extendReservation } from "@/app/admin/(panel)/pedidos/actions";
import { Button } from "@/components/ui/Button";
import { expiryInfo } from "@/lib/admin/order-utils";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";

/** Vencimiento de la reserva de stock con "Extender 24 h" (P0-06). */
export function ReservationControl({ orderId, expiresAt, timeZone }: { orderId: string; expiresAt: string; timeZone: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const info = expiryInfo(expiresAt);

  const extend = async () => {
    setSaving(true);
    const res = await extendReservation({ orderId, hours: 24 });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Reserva extendida hasta el ${formatDateTime(res.data.expiresAt, timeZone)}.`);
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-2">
      <p className={cn("text-sm", info?.soon ? "font-medium text-adm-warning" : "text-adm-fg")} suppressHydrationWarning>
        {info?.label ?? "Sin vencimiento"}
      </p>
      <p className="text-xs text-adm-fg-muted">
        Si no registrás un pago antes del {formatDateTime(expiresAt, timeZone)}, el pedido se cancela solo y el stock vuelve al
        inventario.
      </p>
      <Button size="sm" icon={<CalendarClock />} onClick={extend} loading={saving}>
        Extender 24 h
      </Button>
    </div>
  );
}
