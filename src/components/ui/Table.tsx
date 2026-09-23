import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { PendingOverlay } from "./PendingOverlay";

/**
 * Tabla densa del admin (DESIGN.md §7.5): header sticky 36px con fondo
 * `--adm-table-head`, filas 40px con hover `--adm-row-hover`, 13px,
 * `tabular-nums`, números a la derecha con `numeric`.
 *
 * `pending`: velo translúcido + spinner mientras cambia un filtro. Si no se
 * pasa, la tabla sigue el `pending` del `<UrlPendingScope>` de la página
 * (lo disparan los filtros que usan `useUrlTransition`). `pending={false}`
 * lo apaga.
 */
export function Table({
  className,
  containerClassName,
  pending,
  ...props
}: ComponentPropsWithoutRef<"table"> & { containerClassName?: string; pending?: boolean }) {
  return (
    <div
      className={cn(
        "adm-scroll relative w-full overflow-auto rounded-adm border border-adm-border bg-adm-surface shadow-adm-card",
        containerClassName,
      )}
    >
      <table className={cn("tnum w-full border-collapse text-[13px]", className)} {...props} />
      <PendingOverlay pending={pending} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentPropsWithoutRef<"thead">) {
  return <thead className={cn("sticky top-0 z-[1] bg-adm-table-head", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentPropsWithoutRef<"tbody">) {
  return <tbody className={cn("[&>tr:last-child>td]:border-b-0", className)} {...props} />;
}

export function TR({
  className,
  selected,
  interactive = true,
  ...props
}: ComponentPropsWithoutRef<"tr"> & { selected?: boolean; interactive?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "group/row",
        interactive && "hover:bg-adm-row-hover",
        selected && "bg-adm-accent-2-soft/60 hover:bg-adm-accent-2-soft/60",
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  numeric,
  ...props
}: ComponentPropsWithoutRef<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 border-b border-adm-border px-3 text-left text-xs font-medium whitespace-nowrap text-adm-fg-muted",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  numeric,
  muted,
  ...props
}: ComponentPropsWithoutRef<"td"> & { numeric?: boolean; muted?: boolean }) {
  return (
    <td
      className={cn(
        "h-10 border-b border-adm-border px-3 align-middle text-adm-fg",
        numeric && "text-right tnum whitespace-nowrap",
        muted && "text-adm-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

/** Fila de "sin resultados" dentro de la tabla (alineada a la izquierda). */
export function TableEmpty({
  colSpan,
  title = "No hay resultados",
  description,
  action,
}: {
  colSpan: number;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8">
        <p className="text-[15px] font-semibold text-adm-fg">{title}</p>
        {description ? <p className="mt-1 max-w-prose text-[13px] text-adm-fg-muted">{description}</p> : null}
        {action ? <div className="mt-3 flex gap-2">{action}</div> : null}
      </td>
    </tr>
  );
}
