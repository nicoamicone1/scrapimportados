import Link from "next/link";
import { Fragment, type ComponentPropsWithoutRef, type ReactNode } from "react";

import type { AdminSection } from "@/components/admin/nav";
import { cn } from "@/lib/cn";

import { SectionEyebrow } from "./SectionAccent";

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
 * Estado vacío (BRAND §10, DESIGN.md §7.9): alineado a la izquierda, una
 * burbuja durazno chica con el ícono lineal en tinta + título + una línea
 * útil + acción. Sin ilustraciones.
 */
export function EmptyState({ title, description, actions, icon, className, bare }: EmptyStateProps) {
  return (
    <div className={cn("px-6 py-8 sm:px-8", !bare && "rounded-adm-lg border border-adm-border bg-adm-surface", className)}>
      {icon ? (
        <div
          aria-hidden
          className="eco-bubble mb-4 inline-flex size-11 items-center justify-center bg-eco-durazno text-eco-ink [--eco-bubble-r:16px] [&_svg]:size-5 [&_svg]:stroke-[1.75]"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold text-adm-fg">{title}</p>
      {description ? <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-adm-fg-muted">{description}</p> : null}
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
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
   * Tinta de la sección (punto del rótulo sobre el título). Si falta, se
   * deduce de la ruta con el mapa de `nav.ts`. `false` oculta el rótulo.
   */
  section?: AdminSection | false;
  /** Icono propio (lucide) en el rótulo en lugar del punto. */
  icon?: ReactNode;
}

/** Título de página del panel: Archivo expandida y pesada (BRAND §6.2), 22 → 26 px. */
export const PAGE_TITLE = "eco-display text-[22px] leading-[1.1] text-adm-fg sm:text-[26px]";

/**
 * Encabezado de página del admin (DESIGN.md §7.4): rótulo de sección (o
 * migas en el detalle) + título en display + la línea con el dato útil; las
 * acciones a la derecha (secundaria y luego primaria).
 */
export function PageHeader({ title, description, actions, breadcrumb, children, className, section, icon }: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {breadcrumb?.length ? (
            <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-adm-fg-muted">
              {breadcrumb.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 ? (
                    <span aria-hidden className="text-adm-input-border">
                      /
                    </span>
                  ) : null}
                  {c.href ? (
                    <Link href={c.href} className="rounded-sm underline-offset-[3px] transition-colors duration-[140ms] hover:text-adm-link hover:underline">
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
          ) : section === false ? null : (
            <SectionEyebrow section={section} icon={icon} />
          )}
          <h1 className={PAGE_TITLE}>{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-adm-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
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
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-b-2 border-adm-border bg-adm-surface px-1 font-mono text-[11px] leading-none text-adm-fg-muted",
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
      {/* Números de métrica en Archivo expandida (`.eco-num`, BRAND §6.2). */}
      <div className="eco-num mt-2 truncate text-[24px] leading-7 text-adm-fg sm:text-[30px] sm:leading-8">{value}</div>
      {delta ? <div className={cn("tnum mt-1.5 text-xs", deltaTone)}>{delta}</div> : null}
    </>
  );
  const cls = cn("block min-w-0 px-4 py-4 sm:px-5", href && "transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover", className);
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
        "grid grid-cols-2 divide-adm-border overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface md:grid-flow-col md:auto-cols-fr md:grid-cols-none md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-adm-border md:[&>*:nth-child(n+3)]:border-t-0 [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:border-adm-border md:[&>*:nth-child(even)]:border-l-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
