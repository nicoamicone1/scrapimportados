"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import type { BillingPeriod } from "@/lib/plans/yearly";

import { startMercadoPagoCheckout } from "./actions";

/**
 * "Pagar con MercadoPago": crea la suscripción y lleva al checkout de MP (misma
 * pestaña). El pago se hace con la cuenta de MP del email del dueño.
 * `period = "yearly"`: el año por adelantado (0019).
 */
export function MercadoPagoButton({
  plan,
  period = "monthly",
  primary,
  label = "Pagar con MercadoPago",
}: {
  plan: string;
  period?: BillingPeriod;
  primary?: boolean;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="w-full"
      variant={primary ? "primary" : "secondary"}
      loading={pending}
      loadingText="Abriendo MercadoPago…"
      onClick={() =>
        startTransition(async () => {
          const res = await startMercadoPagoCheckout({ plan, period });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          window.location.assign(res.data.url);
        })
      }
    >
      {label}
    </Button>
  );
}
