"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { cancelMercadoPagoRenewal } from "./actions";

/** "Cancelar renovación" (sólo dueño): el plan sigue hasta el final del período pago. */
export function CancelRenewalButton({ planName, until, pastDue }: { planName: string; until: string | null; pastDue?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Cancelar renovación
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Cancelar la renovación de ${planName}?`}
        description={
          pastDue
            ? `MercadoPago deja de intentar el cobro y la tienda pasa a Free ahora (no se borra nada). Después podés pagar otro plan.`
            : until
            ? `MercadoPago deja de cobrarte. Seguís con ${planName} hasta el ${until}; después la tienda pasa a Free sin borrar nada.`
            : `MercadoPago deja de cobrarte y, al terminar el período pago, la tienda pasa a Free sin borrar nada.`
        }
        confirmLabel="Cancelar renovación"
        cancelLabel="Seguir con el plan"
        destructive
        onConfirm={async () => {
          const res = await cancelMercadoPagoRenewal();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(res.data.summary);
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
