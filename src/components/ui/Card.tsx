import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Panel del admin: superficie blanca, borde fino, radio 6px, sin sombra. */
export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={cn("rounded-adm border border-adm-border bg-adm-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 border-b border-adm-border px-4 py-3", className)}>
      <div className="min-w-0">
        {title ? <h2 className="text-[15px] leading-6 font-semibold text-adm-fg">{title}</h2> : null}
        {description ? <p className="mt-0.5 text-[13px] text-adm-fg-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<"footer">) {
  return (
    <footer
      className={cn("flex items-center justify-end gap-2 border-t border-adm-border bg-adm-surface-2/60 px-4 py-3", className)}
      {...props}
    />
  );
}

/**
 * Sección de formulario de configuración: título + descripción (1/3) y
 * campos (2/3), como pide DESIGN.md §7.6.
 */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 py-6 md:grid-cols-3 md:gap-8", className)}>
      <div>
        <h2 className="text-[15px] font-semibold text-adm-fg">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-adm-fg-muted">{description}</p> : null}
      </div>
      <div className="space-y-4 md:col-span-2">{children}</div>
    </div>
  );
}
