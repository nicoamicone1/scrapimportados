"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

import { requestUpgrade } from "./actions";

/** "Quiero este plan": registra el pedido y abre WhatsApp de la plataforma. */
export function UpgradeButton({ plan, label, primary }: { plan: string; label: string; primary?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="w-full"
      variant={primary ? "primary" : "secondary"}
      loading={pending}
      loadingText="Abriendo WhatsApp…"
      onClick={() => {
        // Se abre la ventana en el click (los navegadores bloquean popups diferidos).
        const win = window.open("about:blank", "_blank");
        startTransition(async () => {
          const res = await requestUpgrade({ plan });
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
