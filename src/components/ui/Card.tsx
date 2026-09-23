import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Panel del admin: superficie blanca, borde `--adm-border`, radio 6px, sombra de superficie. */
export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("rounded-adm border border-adm-border bg-adm-surface shadow-adm-card", className)}
      {...props}
    />
  );
}

/** Etiqueta chica sobre un título ("Pagos", "Paso 2 de 3"). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-medium tracking-[0.06em] text-adm-fg-muted uppercase", className)}>{children}</p>
  );
}

export function CardHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** Etiqueta chica arriba del título. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 border-b border-adm-border px-4 py-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-0.5">{eyebrow}</Eyebrow> : null}
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
      className={cn("flex items-center justify-end gap-2 rounded-b-adm border-t border-adm-border bg-adm-table-head px-4 py-3", className)}
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
  eyebrow,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 py-6 md:grid-cols-3 md:gap-8", className)}>
      <div>
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="text-[15px] font-semibold text-adm-fg">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-adm-fg-muted">{description}</p> : null}
      </div>
      <div className="space-y-4 md:col-span-2">{children}</div>
    </div>
  );
}
