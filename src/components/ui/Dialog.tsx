"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Dialog y Drawer sobre `<dialog>` NATIVO con `showModal()` (sin librería):
 * - el resto de la página queda `inert` (el foco no puede salir: focus trap),
 * - Esc cierra (evento `cancel`), click en el backdrop cierra,
 * - se renderiza en el top layer (sin portales ni z-index),
 * - al cerrar se devuelve el foco al elemento que lo abrió.
 */

interface ModalBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Acciones al pie (alineadas a la derecha). */
  footer?: ReactNode;
  /** Evita cerrar con Esc / backdrop (ej. mientras guarda). */
  dismissable?: boolean;
  className?: string;
  /** Oculta la X del encabezado. */
  hideClose?: boolean;
  /** `aria-label` si no hay `title`. */
  label?: string;
}

function useNativeDialog(open: boolean, onOpenChange: (open: boolean) => void, dismissable: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => {
      returnFocus.current?.focus?.();
      onOpenChange(false);
    };
    const onCancel = (e: Event) => {
      if (!dismissable) e.preventDefault();
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [onOpenChange, dismissable]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (dismissable && e.target === e.currentTarget) ref.current?.close();
  };

  return { ref, onBackdropClick, close: () => ref.current?.close() };
}

const sizes = { sm: "w-[400px]", md: "w-[480px]", lg: "w-[640px]", xl: "w-[800px]" } as const;

export interface DialogProps extends ModalBaseProps {
  size?: keyof typeof sizes;
}

/** Dialog modal. Confirmaciones 480px, formularios 640px (`size="lg"`). */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
  size = "md",
  className,
  hideClose,
  label,
}: DialogProps) {
  const { ref, onBackdropClick, close } = useNativeDialog(open, onOpenChange, dismissable);
  const titleId = useId();
  const descId = useId();

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-label={title ? undefined : label}
      className={cn(
        "adm-dialog m-auto max-h-[85dvh] max-w-[calc(100vw-2rem)] overflow-hidden rounded-adm border-0 bg-adm-surface p-0 text-adm-fg shadow-[var(--adm-shadow)]",
        sizes[size],
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          {title || !hideClose ? (
            <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="text-base font-semibold text-adm-fg">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descId} className="mt-1 text-[13px] text-adm-fg-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              {!hideClose ? (
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </header>
          ) : null}
          <div className="adm-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer ? (
            <footer className="flex items-center justify-end gap-2 border-t border-adm-border bg-adm-surface-2/60 px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

export interface DrawerProps extends ModalBaseProps {
  side?: "right" | "left";
  width?: string;
}

/** Panel lateral modal (edición rápida, filtros, navegación mobile). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
  side = "right",
  width = "w-[420px]",
  className,
  hideClose,
  label,
}: DrawerProps) {
  const { ref, onBackdropClick, close } = useNativeDialog(open, onOpenChange, dismissable);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
      className={cn(
        "adm-dialog adm-drawer fixed inset-y-0 m-0 h-dvh max-h-none max-w-full border-0 bg-adm-surface p-0 text-adm-fg shadow-[var(--adm-shadow)]",
        side === "right" ? "right-0 left-auto" : "adm-drawer-left right-auto left-0",
        width,
        className,
      )}
    >
      {open ? (
        <div className="flex h-full flex-col">
          {title || !hideClose ? (
            <header className="flex items-start justify-between gap-4 border-b border-adm-border px-4 py-3">
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="text-base font-semibold">
                    {title}
                  </h2>
                ) : null}
                {description ? <p className="mt-0.5 text-[13px] text-adm-fg-muted">{description}</p> : null}
              </div>
              {!hideClose ? (
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-adm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </header>
          ) : null}
          <div className="adm-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? (
            <footer className="flex items-center justify-end gap-2 border-t border-adm-border px-4 py-3">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
