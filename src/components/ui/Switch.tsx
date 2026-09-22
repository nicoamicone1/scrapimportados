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
        "relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50",
        isOn ? "border-adm-accent bg-adm-accent" : "border-adm-input-border bg-adm-surface-2",
        !label && className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-100",
          isOn ? "translate-x-[15px]" : "translate-x-[2px]",
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
