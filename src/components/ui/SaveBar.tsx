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
  /** Sangra hasta el borde del contenido del shell (default true). */
  bleed?: boolean;
  className?: string;
}

const ghostOnDark =
  "border border-white/20 text-adm-sidebar-fg hover:border-white/35 hover:bg-white/10 hover:text-white";

/**
 * Barra sticky inferior de guardado (spec §14.6): fondo `--adm-sidebar-bg`,
 * texto claro, "Descartar" + "Guardar" (ámbar). Reemplaza a las barras
 * blancas de cada formulario.
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
        "adm-dark sticky bottom-0 z-40 mt-6 bg-adm-sidebar-bg px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] text-adm-sidebar-fg shadow-[0_-1px_0_rgb(0_0_0/0.08),0_-8px_24px_-12px_rgb(26_35_32/0.35)] md:px-6 md:pb-2.5",
        bleed ? "-mx-4 md:-mx-6" : "rounded-adm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" className={cn("flex items-center gap-2 text-sm", error ? "text-adm-danger-on-dark" : "text-adm-sidebar-fg")}>
          <span aria-hidden className={cn("size-1.5 rounded-full", error ? "bg-adm-danger-on-dark" : "bg-adm-accent-2")} />
          {message}
        </p>
        {children}
        <div className="flex items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
          {discardHref ? (
            <ButtonLink href={discardHref} variant="ghost" className={ghostOnDark}>
              {discardLabel}
            </ButtonLink>
          ) : onDiscard ? (
            <Button variant="ghost" onClick={onDiscard} disabled={saving || discardDisabled} className={ghostOnDark}>
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
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
