import { ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export const controlClass =
  "w-full rounded-adm border border-adm-input-border bg-adm-surface text-sm text-adm-fg placeholder:text-adm-fg-muted/70 transition-colors hover:border-[#bdb7ab] disabled:cursor-not-allowed disabled:bg-adm-surface-2 disabled:text-adm-fg-muted read-only:bg-adm-surface-2 aria-invalid:border-adm-danger";

type ControlSize = "sm" | "md";

const heights: Record<ControlSize, string> = { sm: "h-8", md: "h-9" };

export interface InputProps extends Omit<ComponentPropsWithoutRef<"input">, "size" | "prefix"> {
  size?: ControlSize;
  /** Adorno a la izquierda (ej. "$" o un icono). */
  leading?: ReactNode;
  /** Adorno a la derecha (ej. "%" o "kg"). */
  trailing?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", leading, trailing, invalid, className, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(
        controlClass,
        heights[size],
        "px-2.5",
        leading ? "pl-7" : "",
        trailing ? "pr-8" : "",
        props.type === "number" ? "tnum" : "",
        !leading && !trailing ? className : "",
      )}
      {...props}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className={cn("relative flex items-center", className)}>
      {leading ? (
        <span className="pointer-events-none absolute left-2.5 flex items-center text-[13px] text-adm-fg-muted [&_svg]:size-4">
          {leading}
        </span>
      ) : null}
      {input}
      {trailing ? (
        <span className="pointer-events-none absolute right-2.5 flex items-center text-[13px] text-adm-fg-muted [&_svg]:size-4">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

export interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || props["aria-invalid"] || undefined}
      className={cn(controlClass, "min-h-[72px] resize-y px-2.5 py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "size"> {
  size?: ControlSize;
  invalid?: boolean;
  /** Opciones simples; también se pueden pasar `<option>` como children. */
  options?: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

/** `<select>` nativo estilizado (accesible y rápido; sin librería). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = "md", invalid, options, placeholder, className, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"] || undefined}
        className={cn(controlClass, heights[size], "cursor-pointer appearance-none pl-2.5 pr-8")}
        {...props}
      >
        {placeholder !== undefined ? (
          <option value="" disabled={props.required}>
            {placeholder}
          </option>
        ) : null}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-adm-fg-muted"
      />
    </div>
  );
});

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  label?: ReactNode;
  description?: ReactNode;
}

/** Checkbox nativo con `accent-color` del admin. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, ...props },
  ref,
) {
  const box = (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-4 shrink-0 cursor-pointer rounded-[3px] border-adm-input-border accent-[var(--adm-accent)] disabled:cursor-not-allowed",
        label ? "mt-0.5" : className,
      )}
      {...props}
    />
  );
  if (!label) return box;
  return (
    <label className={cn("flex cursor-pointer items-start gap-2 text-sm", props.disabled && "cursor-not-allowed opacity-60", className)}>
      {box}
      <span>
        <span className="text-adm-fg">{label}</span>
        {description ? <span className="block text-xs text-adm-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
});

export function Label({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return <label className={cn("text-[13px] font-medium text-adm-fg", className)} {...props} />;
}
