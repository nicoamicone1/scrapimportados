"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toasts neutros del admin (DESIGN.md §1.2): superficie, borde y texto; sólo
 * el ícono lleva color. Usá `toast.success("Producto guardado")` de `sonner`
 * (re-exportado en `@/components/ui`).
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      // Suben cuando hay barra inferior mobile o SaveBar (variables en admin.css).
      offset={{ bottom: "var(--adm-toast-bottom, 24px)", right: 24 }}
      mobileOffset={{ bottom: "var(--adm-toast-mobile-bottom, 16px)", left: 16, right: 16 }}
      closeButton
      duration={4000}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!rounded-adm !border !border-adm-border !bg-adm-surface !text-adm-fg !shadow-[var(--adm-shadow)] !font-[family-name:var(--eco-font-text)] !text-sm",
          description: "!text-adm-fg-muted !text-[13px]",
          actionButton: "!bg-adm-accent !text-adm-accent-fg !rounded-adm",
          cancelButton: "!bg-adm-surface-2 !text-adm-fg !rounded-adm",
          success: "[&_[data-icon]]:!text-adm-success",
          error: "[&_[data-icon]]:!text-adm-danger",
          warning: "[&_[data-icon]]:!text-adm-warning",
          info: "[&_[data-icon]]:!text-adm-info",
        },
      }}
    />
  );
}
