"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

import { startMercadoPagoCheckout } from "./actions";

/** "Pagar con MercadoPago": crea la suscripción y lleva al checkout de MP (misma pestaña). */
export function MercadoPagoButton({ plan, primary }: { plan: string; primary?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="w-full"
      variant={primary ? "primary" : "secondary"}
      loading={pending}
      loadingText="Abriendo MercadoPago…"
      onClick={() =>
        startTransition(async () => {
          const res = await startMercadoPagoCheckout({ plan });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          window.location.assign(res.data.url);
        })
      }
    >
      Pagar con MercadoPago
    </Button>
  );
}
