"use client";

import { useState, type ReactNode } from "react";

import { Button } from "./Button";
import { Dialog } from "./Dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Verbo exacto: "Archivar 3 productos", "Cancelar pedido". Nunca "Aceptar". */
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Puede ser async: el botón muestra spinner y el dialog no se cierra hasta que termine. */
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

/** Confirmación para acciones destructivas o irreversibles. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={title}
      description={description}
      dismissable={!pending}
      hideClose
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={confirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
