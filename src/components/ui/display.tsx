import Link from "next/link";
import { Fragment, type ComponentPropsWithoutRef, type ReactNode } from "react";

import type { AdminSection } from "@/components/admin/nav";
import { cn } from "@/lib/cn";

import { SectionIcon } from "./SectionAccent";

/* EmptyState, PageHeader, Skeleton, Kbd, Stat/StatStrip (server-friendly). */

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Acción primaria + secundaria (botones). */
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Sin borde (para usar dentro de un Card o tabla). */
  bare?: boolean;
}

/**
 * Estado vacío (DESIGN.md §7.9): alineado a la izquierda, título + una línea
 * útil + acción. Sin ilustraciones: a lo sumo un icono lineal grande en
 * `--adm-fg-subtle`.
 */
export function EmptyState({ title, description, actions, icon, className, bare }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "px-6 py-8",
        !bare && "rounded-adm border border-adm-border bg-adm-surface shadow-adm-card",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden className="mb-4 text-adm-fg-subtle [&_svg]:size-10 [&_svg]:stroke-[1.25]">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold text-adm-fg">{title}</p>
      {description ? <p className="mt-1 max-w-prose text-[13px] text-adm-fg-muted">{description}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  /** Dato útil: "142 productos activos · 8 sin stock". */
  description?: ReactNode;
  /** Botones a la derecha (secundaria y luego primaria). */
  actions?: ReactNode;
  /** Sólo en vistas de detalle ("Pedidos / #1043"). */
  breadcrumb?: Crumb[];
  /** Debajo del título (ej. `<TabsNav>`). */
  children?: ReactNode;
  className?: string;
  /**
   * Tinta de la sección (icono con fondo tintado). Si falta, se deduce de la
   * ruta con el mapa de `nav.ts`. `false` oculta el icono.
   */
  section?: AdminSection | false;
  /** Icono propio (lucide) en lugar del de la entrada del menú. */
  icon?: ReactNode;
}

/** Encabezado de página del admin (DESIGN.md §7.4 + tinta de sección §14.6). */
export function PageHeader({ title, description, actions, breadcrumb, children, className, section, icon }: PageHeaderProps) {
  return (
    <div className={cn("mb-5", className)}>
      {breadcrumb?.length ? (
        <nav aria-label="Ruta" className="mb-1.5 flex items-center gap-1.5 text-[13px] text-adm-fg-muted">
          {breadcrumb.map((c, i) => (
            <Fragment key={i}>
              {i > 0 ? <span aria-hidden>/</span> : null}
              {c.href ? (
                <Link href={c.href} className="hover:text-adm-fg hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-adm-fg">
                  {c.label}
                </span>
              )}
            </Fragment>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          {section === false ? null : <SectionIcon section={section} icon={icon} className="mt-px hidden sm:inline-flex" />}
          <div className="min-w-0">
            <h1 className="text-xl leading-7 font-semibold text-adm-fg">{title}</h1>
            {description ? <p className="mt-0.5 text-sm text-adm-fg-muted">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** Bloque de carga con shimmer sutil (clase global `.sk`). */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div aria-hidden className={cn("sk rounded-adm", className)} {...props} />;
}

/** Tecla: <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> */
export function Kbd({ className, ...props }: ComponentPropsWithoutRef<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-adm-sm border border-adm-border bg-adm-surface px-1 font-mono text-[11px] leading-none text-adm-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** "+12 % vs. semana anterior" */
  delta?: ReactNode;
  /** Colorea el delta como alerta. */
  alert?: boolean;
  /** Dirección de la variación: verde / rojo secos (sin flechas ni fondos). */
  trend?: "up" | "down" | "flat";
  href?: string;
  className?: string;
}

/** Métrica tipográfica (DESIGN.md §7.8). Usala dentro de `<StatStrip>`. */
export function Stat({ label, value, delta, alert, trend, href, className }: StatProps) {
  const deltaTone = alert
    ? "text-adm-warning"
    : trend === "up"
      ? "text-adm-success"
      : trend === "down"
        ? "text-adm-danger"
        : "text-adm-fg-muted";
  const body = (
    <>
      <div className="text-xs font-medium text-adm-fg-muted">{label}</div>
      <div className="tnum mt-1.5 text-[28px] leading-8 font-semibold tracking-[-0.01em] text-adm-fg">{value}</div>
      {delta ? <div className={cn("tnum mt-1.5 text-xs", deltaTone)}>{delta}</div> : null}
    </>
  );
  const cls = cn("block min-w-0 px-5 py-4", href && "transition-colors hover:bg-adm-row-hover", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Franja única con métricas separadas por reglas verticales. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-adm-border overflow-hidden rounded-adm border border-adm-border bg-adm-surface shadow-adm-card md:grid-flow-col md:auto-cols-fr md:grid-cols-none md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-adm-border md:[&>*:nth-child(n+3)]:border-t-0 [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:border-adm-border md:[&>*:nth-child(even)]:border-l-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
