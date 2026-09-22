"use client";

import { Bell, BellOff } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

const noopSubscribe = () => () => {};

/**
 * Pide permiso para las notificaciones del navegador (P0-07). Se pide desde
 * un click (los navegadores bloquean el pedido automático). El aviso en sí lo
 * dispara `OrdersBadge` cuando entra un pedido nuevo con el panel abierto.
 */
export function NotificationsToggle() {
  // En el server no existe `Notification`: se asume "default" y se lee al hidratar.
  const current = useSyncExternalStore<PermissionState>(
    noopSubscribe,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "default",
  );
  const [override, setState] = useState<PermissionState | null>(null);
  const state = override ?? current;

  if (state === "unsupported") return null;

  if (state === "granted") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-[13px] text-adm-fg-muted" title="Te avisamos con el panel abierto">
        <Bell className="size-4" aria-hidden />
        Avisos de pedidos activados
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span
        className="inline-flex h-8 items-center gap-1.5 text-[13px] text-adm-fg-muted"
        title="Habilitalos desde el candado de la barra de direcciones"
      >
        <BellOff className="size-4" aria-hidden />
        Avisos bloqueados en el navegador
      </span>
    );
  }

  return (
    <Button
      icon={<Bell />}
      onClick={async () => {
        const result = await Notification.requestPermission();
        setState(result);
        if (result === "granted") {
          toast.success("Listo: te avisamos cuando entre un pedido mientras el panel esté abierto.");
          try {
            new Notification("Avisos activados", { body: "Así se van a ver los pedidos nuevos." });
          } catch {
            // sin notificaciones directas (algunos Android)
          }
        }
      }}
    >
      Avisarme de pedidos nuevos
    </Button>
  );
}
