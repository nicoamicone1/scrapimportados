"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toasts del admin (BRAND §10): pastilla tinta con texto claro que entra con
 * rebote (curva en admin.css); sólo el ícono lleva el color semántico, en su
 * variante para fondo oscuro. Usá `toast.success("Producto guardado")` de
 * `sonner` (re-exportado en `@/components/ui`).
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
            "adm-dark !gap-2.5 !rounded-[22px] !border-0 !bg-eco-ink !py-3 !pr-4 !pl-4 !text-eco-mist !shadow-[0_18px_40px_-14px_rgb(16_22_47/0.55)] !font-[family-name:var(--eco-font-text)] !text-sm",
          title: "!font-medium !text-white",
          description: "!text-eco-bruma !text-[13px]",
          actionButton: "!h-7 !rounded-full !bg-eco-pomelo !px-3 !font-semibold !text-eco-ink",
          cancelButton: "!h-7 !rounded-full !bg-white/10 !px-3 !text-white",
          success: "[&_[data-icon]]:!text-[var(--adm-success-on-dark)]",
          error: "[&_[data-icon]]:!text-[var(--adm-danger-on-dark)]",
          warning: "[&_[data-icon]]:!text-[var(--adm-warning-on-dark)]",
          info: "[&_[data-icon]]:!text-[var(--adm-info-on-dark)]",
        },
      }}
    />
  );
}
