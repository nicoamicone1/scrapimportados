"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  invalid?: boolean;
  required?: boolean;
};

export interface FieldProps {
  label: ReactNode;
  /** Ayuda debajo (12px muted). El error la reemplaza. */
  hint?: ReactNode;
  /** Mensaje de error (string o lista de `fieldErrors`). */
  error?: string | string[] | null;
  required?: boolean;
  /** Un solo control (Input, Select, Textarea…). Se le inyectan id y aria-*. */
  children: ReactElement<ControlProps>;
  className?: string;
  /** Texto a la derecha del label (ej. contador "0/160"). */
  aside?: ReactNode;
}

/**
 * Label arriba (13px/500) + control + ayuda o error (DESIGN.md §7.6).
 * Conecta `htmlFor`, `aria-describedby` y `aria-invalid` automáticamente.
 */
export function Field({ label, hint, error, required, children, className, aside }: FieldProps) {
  const autoId = useId();
  const id = (isValidElement(children) && children.props.id) || autoId;
  const message = Array.isArray(error) ? error[0] : error;
  const describedBy = message || hint ? `${id}-desc` : undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        invalid: Boolean(message) || undefined,
        required: required ?? children.props.required,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <label htmlFor={id} className="text-[13px] font-medium text-adm-fg">
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-adm-fg-muted">
              *
            </span>
          ) : null}
        </label>
        {aside ? <span className="text-xs text-adm-fg-muted">{aside}</span> : null}
      </div>
      {control}
      {message ? (
        <p id={describedBy} className="text-xs text-adm-danger">
          {message}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-xs text-adm-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
