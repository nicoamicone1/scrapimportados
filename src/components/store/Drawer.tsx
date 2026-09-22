"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: "left" | "right";
  /** `full`: panel a pantalla completa (menú del header `minimal`). */
  size?: "sm" | "md" | "full";
  children: ReactNode;
  footer?: ReactNode;
  /** Título visible (si no, sólo para lectores de pantalla). */
  showTitle?: boolean;
  className?: string;
}

/**
 * Drawer del storefront: `role="dialog"` modal, foco atrapado, Esc cierra y
 * devuelve el foco al disparador. Sin blur (DESIGN.md §1.1); sombra sólo
 * acá porque es una capa que está encima.
 */
export function Drawer({ open, onClose, title, side = "right", size = "md", children, footer, showTitle = true, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      returnTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="backdrop drawer-fade absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "panel-float drawer absolute top-0 flex h-full flex-col",
          side === "right" ? "right-0 drawer-in-right" : "left-0 drawer-in-left",
          size === "full" ? "w-full" : size === "sm" ? "w-[min(360px,88vw)]" : "w-full sm:w-[420px]",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <h2 id={titleId} className={cn("font-body text-base font-semibold tracking-normal normal-case", !showTitle && "sr-only")}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-md hover:bg-surface"
            aria-label="Cerrar"
          >
            <X className="size-5" aria-hidden strokeWidth={1.5} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-border px-4 py-4 sm:px-5">{footer}</div> : null}
      </div>
    </div>
  );
}
