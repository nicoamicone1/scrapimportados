"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button, ButtonLink } from "./Button";

export interface SaveBarProps {
  /** Si es false no se renderiza (default true). */
  visible?: boolean;
  /** Texto de estado a la izquierda (default "Cambios sin guardar"). */
  message?: ReactNode;
  /** El mensaje es un error ("Revisá los campos marcados"). */
  error?: boolean;
  saving?: boolean;
  /** Si falta, el botón de guardar es `type="submit"` (para usar dentro de un `<form>`). */
  onSave?: () => void;
  saveLabel?: ReactNode;
  savingLabel?: ReactNode;
  saveDisabled?: boolean;
  /** Acción secundaria: descartar (botón) o cancelar (link con `discardHref`). */
  onDiscard?: () => void;
  discardHref?: string;
  discardLabel?: ReactNode;
  discardDisabled?: boolean;
  /** Contenido extra entre el mensaje y los botones. */
  children?: ReactNode;
  /**
   * Compatibilidad: antes la barra iba de borde a borde del contenido. Ahora
   * siempre es una pastilla flotante centrada; `bleed={false}` la alinea a la
   * izquierda del contenedor en lugar de centrarla.
   */
  bleed?: boolean;
  className?: string;
}

const ghostOnDark = "text-eco-mist hover:bg-white/10 hover:text-white";

/**
 * Barra de guardado (BRAND §10): pastilla tinta flotante, centrada abajo,
 * que sube con un rebote corto al aparecer: "● Cambios sin guardar ·
 * Descartar · Guardar" (pomelo). Lleva `data-adm-bottom-bar` (oculta la
 * barra inferior mobile y sube los toasts). En mobile ocupa el ancho con
 * margen de 12 px y los botones se reparten el ancho.
 */
export function SaveBar({
  visible = true,
  message = "Cambios sin guardar",
  error,
  saving = false,
  onSave,
  saveLabel = "Guardar",
  savingLabel = "Guardando…",
  saveDisabled,
  onDiscard,
  discardHref,
  discardLabel = "Descartar",
  discardDisabled,
  children,
  bleed = true,
  className,
}: SaveBarProps) {
  if (!visible) return null;
  return (
    <div
      data-adm-bottom-bar=""
      className={cn(
        "pointer-events-none sticky bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 mt-6 flex",
        bleed ? "justify-center" : "justify-start",
        className,
      )}
    >
      <div
        className={cn(
          "adm-dark adm-rise-in pointer-events-auto flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[22px] bg-eco-ink py-2 pr-2 pl-5 text-eco-mist shadow-[0_18px_44px_-14px_rgb(16_22_47/0.6)] sm:w-auto sm:max-w-full",
          // Con contenido extra (ej. opciones de publicación) puede ocupar dos líneas.
          children ? "sm:rounded-[22px]" : "sm:flex-nowrap sm:rounded-full",
        )}
      >
        <p role="status" className={cn("flex min-w-0 items-center gap-2.5 text-sm", error ? "text-adm-danger-on-dark" : "text-eco-mist")}>
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", error ? "bg-adm-danger-on-dark" : "bg-eco-pomelo")} />
          <span className="truncate">{message}</span>
        </p>
        {children}
        <div className="flex items-center gap-1.5 max-sm:w-full max-sm:[&>*]:flex-1">
          {discardHref ? (
            <ButtonLink href={discardHref} variant="ghost" className={cn(ghostOnDark, "rounded-full")}>
              {discardLabel}
            </ButtonLink>
          ) : onDiscard ? (
            <Button variant="ghost" onClick={onDiscard} disabled={saving || discardDisabled} className={cn(ghostOnDark, "rounded-full")}>
              {discardLabel}
            </Button>
          ) : null}
          <Button
            variant="accent"
            type={onSave ? "button" : "submit"}
            onClick={onSave}
            loading={saving}
            loadingText={savingLabel}
            disabled={saveDisabled}
            className="rounded-full px-4"
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
