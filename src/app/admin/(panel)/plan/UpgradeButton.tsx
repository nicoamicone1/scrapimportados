"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button, type ButtonVariant } from "@/components/ui/Button";
import type { BillingPeriod } from "@/lib/plans/yearly";

import { requestUpgrade } from "./actions";

/**
 * "Quiero este plan": registra el pedido y abre WhatsApp de la plataforma.
 * `period`: sólo si el plan tiene pago anual (el mensaje dice cuál eligió).
 */
export function UpgradeButton({
  plan,
  label,
  primary,
  period,
  variant,
}: {
  plan: string;
  label: string;
  primary?: boolean;
  period?: BillingPeriod;
  /** Por defecto, primary o secondary según `primary`. */
  variant?: ButtonVariant;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className={variant === "link" ? "text-[13px]" : "w-full"}
      variant={variant ?? (primary ? "primary" : "secondary")}
      loading={pending}
      loadingText="Abriendo WhatsApp…"
      onClick={() => {
        // Se abre la ventana en el click (los navegadores bloquean popups diferidos).
        const win = window.open("about:blank", "_blank");
        startTransition(async () => {
          const res = await requestUpgrade({ plan, period });
          if (!res.ok) {
            win?.close();
            toast.error(res.error);
            return;
          }
          if (res.data.url) {
            if (win) win.location.href = res.data.url;
            else window.location.href = res.data.url;
            toast.success("Te abrimos WhatsApp con el pedido. Lo activamos en el día.");
          } else {
            win?.close();
            toast.success("Registramos tu pedido. Te contactamos para activarlo.");
          }
        });
      }}
    >
      {label}
    </Button>
  );
}
