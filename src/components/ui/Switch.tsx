"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Si se pasa, incluye un `<input type="hidden">` con "on"/"" para formularios. */
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

/** Interruptor accesible (`role="switch"`). Controlado o no controlado. */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  name,
  label,
  description,
  id,
  className,
  ...aria
}: SwitchProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = checked ?? internal;

  const toggle = () => {
    if (disabled) return;
    const next = !isOn;
    if (checked === undefined) setInternal(next);
    onCheckedChange?.(next);
  };

  const control = (
    <button
      id={controlId}
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={aria["aria-label"]}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-[240ms] ease-eco-out disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:before:absolute pointer-coarse:before:-inset-x-2 pointer-coarse:before:-inset-y-3 pointer-coarse:before:content-['']",
        // Encendido = selección (azul de interacción, BRAND §5.3).
        isOn ? "border-[var(--adm-select)] bg-[var(--adm-select)]" : "border-adm-input-border bg-adm-surface-2",
        !label && className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          // La perilla llega con un rebote corto (--eco-ease-spring).
          "inline-block size-3.5 rounded-full shadow-[0_1px_2px_rgb(16_22_47/0.25)] transition-[transform,background-color] duration-[420ms] ease-eco-spring",
          // Apagado: perilla gris (5:1 sobre el riel) para que el estado no dependa sólo del color del riel.
          isOn ? "translate-x-[18px] bg-white" : "translate-x-[2px] bg-adm-fg-muted",
        )}
      />
      {name ? <input type="hidden" name={name} value={isOn ? "on" : ""} /> : null}
    </button>
  );

  if (!label) return control;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={controlId} className="cursor-pointer text-sm text-adm-fg">
          {label}
        </label>
        {description ? <div className="text-xs text-adm-fg-muted">{description}</div> : null}
      </div>
      {control}
    </div>
  );
}
