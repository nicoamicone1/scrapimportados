"use client";

import { useFormStatus } from "react-dom";
import { forwardRef, type ReactNode } from "react";

import { Button, type ButtonProps } from "./Button";

export type SubmitButtonProps = Omit<ButtonProps, "type"> & {
  /** Texto mientras se envía (default "Guardando…"). `null` mantiene el label. */
  pendingText?: ReactNode | null;
};

/**
 * Botón `type="submit"` que muestra spinner + texto mientras el `<form>` que lo
 * contiene está enviando (server action vía `action={…}`), y evita el doble
 * submit. Si además pasás `loading`, gana cualquiera de los dos.
 */
export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(function SubmitButton(
  { pendingText = "Guardando…", loading, loadingText, variant = "primary", ...props },
  ref,
) {
  const { pending } = useFormStatus();
  const busy = Boolean(loading) || pending;
  return (
    <Button
      ref={ref}
      type="submit"
      variant={variant}
      loading={busy}
      loadingText={loadingText ?? (pendingText === null ? undefined : pendingText)}
      {...props}
    />
  );
});
