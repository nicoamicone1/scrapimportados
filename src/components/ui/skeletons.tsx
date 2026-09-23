import type { ReactNode } from "react";

import type { AdminSection } from "@/components/admin/nav";
import { cn } from "@/lib/cn";

import { Skeleton } from "./display";
import { SectionIcon } from "./SectionAccent";

/*
 * Skeletons del admin (spec §14.5): imitan la página real (PageHeader +
 * tabla / formulario / grilla / detalle) con shimmer sutil (`.sk`).
 * Se usan desde los `loading.tsx` de cada ruta.
 */

const panel = "rounded-adm border border-adm-border bg-adm-surface shadow-adm-card";

/** Anchos "orgánicos" deterministas (sin Math.random: el HTML del server y el cliente coinciden). */
const W = ["w-[62%]", "w-[48%]", "w-[74%]", "w-[40%]", "w-[56%]", "w-[68%]", "w-[44%]", "w-[80%]"];
const w = (i: number) => W[i % W.length];

/** Contenedor accesible: anuncia "Cargando…" una vez. */
export function SkeletonRegion({
  label = "Cargando…",
  children,
  className,
  bodyClassName,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  /** Clases del contenedor interno (ej. layouts flex de pantalla completa). */
  bodyClassName?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className={bodyClassName}>
        {children}
      </div>
    </div>
  );
}

export interface HeaderSkeletonProps {
  /** Pestañas debajo del título (TabsNav). */
  tabs?: number;
  /** Botones a la derecha. */
  actions?: number;
  description?: boolean;
  breadcrumb?: boolean;
  /** Tinta de la sección (si falta, se deduce de la ruta). */
  section?: AdminSection;
  /** Título real si se conoce ("Pedidos"): mejor que una barra gris. */
  title?: string;
}

export function HeaderSkeleton({ tabs = 0, actions = 1, description = true, breadcrumb, section, title }: HeaderSkeletonProps) {
  return (
    <div className="mb-5">
      {breadcrumb ? <Skeleton className="mb-2 h-3.5 w-40" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <SectionIcon section={section} className="mt-px hidden opacity-70 sm:inline-flex" />
          <div className="min-w-0">
            {title ? (
              <h1 className="text-xl leading-7 font-semibold text-adm-fg">{title}</h1>
            ) : (
              <Skeleton className="mt-1 h-5 w-44" />
            )}
            {description ? <Skeleton className="mt-2 h-3.5 w-64 max-w-[70vw]" /> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Skeleton key={i} className={cn("h-8", i === actions - 1 ? "w-32" : "w-24")} />
            ))}
          </div>
        ) : null}
      </div>
      {tabs ? (
        <div className="mt-4 flex gap-5 border-b border-adm-border pb-2.5">
          {Array.from({ length: tabs }, (_, i) => (
            <Skeleton key={i} className={cn("h-3.5", i === 0 ? "w-16" : "w-20")} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  /** Barra de filtros arriba (buscador + selects). */
  filters?: number | false;
  /** Primera columna con miniatura 32px (productos). */
  thumb?: boolean;
  /** Checkbox de selección al inicio. */
  select?: boolean;
  className?: string;
}

export function TableSkeleton({ rows = 8, cols = 5, filters = 2, thumb, select, className }: TableSkeletonProps) {
  return (
    <div className={className}>
      {filters !== false ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-full sm:w-72" />
          {Array.from({ length: filters }, (_, i) => (
            <Skeleton key={i} className="h-8 w-36" />
          ))}
        </div>
      ) : null}
      <div className={cn(panel, "overflow-hidden")}>
        <div className="flex h-9 items-center gap-6 border-b border-adm-border bg-adm-table-head px-3">
          {select ? <Skeleton className="size-4 rounded-[3px]" /> : null}
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn("h-3", c === 0 ? "w-28 flex-[2]" : "w-14 flex-1")} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex h-10 items-center gap-6 border-b border-adm-border px-3 last:border-b-0">
            {select ? <Skeleton className="size-4 shrink-0 rounded-[3px]" /> : null}
            {Array.from({ length: cols }, (_, c) =>
              c === 0 ? (
                <div key={c} className="flex min-w-0 flex-[2] items-center gap-2.5">
                  {thumb ? <Skeleton className="size-7 shrink-0 rounded-[4px]" /> : null}
                  <Skeleton className={cn("h-3", w(r))} />
                </div>
              ) : (
                <div key={c} className={cn("flex flex-1", c === cols - 1 && "justify-end")}>
                  <Skeleton className={cn("h-3", c === cols - 1 ? "w-16" : w(r + c))} />
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between py-3">
        <Skeleton className="h-3 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}

function FieldSkeleton({ i = 0, tall }: { i?: number; tall?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className={cn("h-3", i % 2 ? "w-20" : "w-28")} />
      <Skeleton className={cn("w-full", tall ? "h-20" : "h-9")} />
    </div>
  );
}

export interface FormSkeletonProps {
  /** Cantidad de paneles. */
  sections?: number;
  /** Campos por panel. */
  fields?: number;
  /** Columna lateral (4/12) como en el formulario de producto. */
  aside?: boolean;
  /** Paneles de configuración (título 1/3 + campos 2/3). */
  split?: boolean;
  /** Barra sticky de guardar al pie. */
  saveBar?: boolean;
}

function FormPanel({ fields, index }: { fields: number; index: number }) {
  return (
    <div className={panel}>
      <div className="border-b border-adm-border px-4 py-3">
        <Skeleton className={cn("h-4", index % 2 ? "w-28" : "w-36")} />
        <Skeleton className="mt-2 h-3 w-60 max-w-full" />
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {Array.from({ length: fields }, (_, f) => (
          <div key={f} className={cn(f === 0 && "md:col-span-2")}>
            <FieldSkeleton i={f + index} tall={f === fields - 1 && fields > 3} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ sections = 2, fields = 4, aside, split, saveBar }: FormSkeletonProps) {
  if (split) {
    return (
      <div className={cn(panel, "divide-y divide-adm-border px-4 md:px-6")}>
        {Array.from({ length: sections }, (_, s) => (
          <div key={s} className="grid gap-4 py-6 md:grid-cols-3 md:gap-8">
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-full max-w-56" />
              <Skeleton className="mt-1.5 h-3 w-40" />
            </div>
            <div className="space-y-4 md:col-span-2">
              {Array.from({ length: fields }, (_, f) => (
                <FieldSkeleton key={f} i={f + s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const main = (
    <div className="min-w-0 space-y-4">
      {Array.from({ length: sections }, (_, s) => (
        <FormPanel key={s} fields={fields} index={s} />
      ))}
    </div>
  );
  return (
    <>
      {aside ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {main}
          <div className="space-y-4">
            <FormPanel fields={2} index={1} />
            <div className={cn(panel, "p-4")}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 aspect-square w-full" />
            </div>
          </div>
        </div>
      ) : (
        main
      )}
      {saveBar ? <div className="-mx-4 mt-6 h-[52px] bg-adm-sidebar-bg md:-mx-6" /> : null}
    </>
  );
}

export interface CardsSkeletonProps {
  count?: number;
  /** Clases de la grilla (default 1/2/3 columnas). */
  gridClassName?: string;
  /** Alto del bloque "media" de cada card (ej. preview de preset). */
  media?: boolean;
}

export function CardsSkeleton({ count = 6, gridClassName, media }: CardsSkeletonProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", gridClassName)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(panel, "p-4")}>
          {media ? <Skeleton className="mb-4 h-28 w-full" /> : null}
          <Skeleton className={cn("h-4", w(i))} />
          <Skeleton className="mt-2.5 h-3 w-[85%]" />
          <Skeleton className="mt-1.5 h-3 w-[60%]" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn(panel, "grid grid-cols-2 overflow-hidden md:grid-flow-col md:auto-cols-fr md:grid-cols-none")}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "px-5 py-4",
            i > 0 && "md:border-l md:border-adm-border",
            i % 2 === 1 && "border-l border-adm-border",
            i >= 2 && "border-t border-adm-border md:border-t-0",
          )}
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2.5 h-7 w-32" />
          <Skeleton className="mt-2.5 h-3 w-36 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function ListPanel({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className={panel}>
      {title ? (
        <div className="flex items-center justify-between border-b border-adm-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-16" />
        </div>
      ) : null}
      <div className="divide-y divide-adm-border">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-8 shrink-0 rounded-[4px]" />
            <div className="min-w-0 flex-1">
              <Skeleton className={cn("h-3", w(r))} />
              <Skeleton className="mt-1.5 h-2.5 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vista de detalle 8/4 (pedido, cliente, importación). */
export function DetailSkeleton({ main = 3, aside = 3 }: { main?: number; aside?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="min-w-0 space-y-4 lg:col-span-8">
        {Array.from({ length: main }, (_, i) => (
          <ListPanel key={i} rows={i === 0 ? 4 : 2} />
        ))}
      </div>
      <div className="space-y-4 lg:col-span-4">
        {Array.from({ length: aside }, (_, i) => (
          <div key={i} className={cn(panel, "p-4")}>
            <Skeleton className="h-4 w-24" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-[80%]" />
              <Skeleton className="h-3 w-[60%]" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type PageSkeletonVariant = "table" | "form" | "cards" | "detail" | "dashboard" | "list";

export interface PageSkeletonProps extends HeaderSkeletonProps {
  variant?: PageSkeletonVariant;
  /** Filas de tabla / cards / campos, según la variante. */
  rows?: number;
  cols?: number;
  /** Contenido propio en lugar del cuerpo por variante. */
  children?: ReactNode;
}

/**
 * Página completa en carga: cabecera (con la tinta de la sección) + cuerpo.
 * `loading.tsx` típico: `<PageSkeleton title="Pedidos" tabs={5} variant="table" cols={8} />`.
 */
export function PageSkeleton({ variant = "table", rows, cols, children, ...header }: PageSkeletonProps) {
  let body: ReactNode = children;
  if (!body) {
    switch (variant) {
      case "table":
        body = <TableSkeleton rows={rows ?? 10} cols={cols ?? 5} />;
        break;
      case "form":
        body = <FormSkeleton sections={rows ?? 2} />;
        break;
      case "cards":
        body = <CardsSkeleton count={rows ?? 6} />;
        break;
      case "detail":
        body = <DetailSkeleton />;
        break;
      case "list":
        body = <ListPanel rows={rows ?? 6} />;
        break;
      case "dashboard":
        body = (
          <div className="space-y-4">
            <StatsSkeleton />
            <div className={cn(panel, "p-4")}>
              <Skeleton className="h-4 w-48" />
              <div className="mt-4 flex h-40 items-end gap-1.5">
                {Array.from({ length: 30 }, (_, i) => (
                  <Skeleton key={i} className="flex-1 rounded-[2px]" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
                ))}
              </div>
            </div>
            <DetailSkeleton main={2} aside={2} />
          </div>
        );
        break;
    }
  }
  return (
    <SkeletonRegion>
      <HeaderSkeleton {...header} />
      {body}
    </SkeletonRegion>
  );
}

export { ListPanel as ListSkeleton };

/**
 * Pantallas de cuenta fuera del panel (/app, /platform): header blanco de 56px
 * (marca + links) y contenido centrado, como `AppHeader` + `<main>`.
 */
export function AccountPageSkeleton({
  title,
  width = "max-w-6xl",
  breadcrumb,
  children,
}: {
  title?: string;
  width?: "max-w-6xl" | "max-w-5xl";
  breadcrumb?: boolean;
  children: ReactNode;
}) {
  return (
    <SkeletonRegion className="min-h-dvh">
      <div className="border-b border-adm-border bg-adm-surface">
        <div className={cn("mx-auto flex h-14 items-center gap-6 px-4 sm:px-6", width)}>
          <span className="inline-flex size-7 items-center justify-center rounded-[5px] bg-adm-sidebar-bg text-[14px] leading-none font-bold text-adm-accent-2">
            e
          </span>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-7 w-14" />
        </div>
      </div>
      <div className={cn("mx-auto px-4 py-8 sm:px-6", width)}>
        {breadcrumb ? <Skeleton className="mb-2 h-3 w-32" /> : null}
        {title ? <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1> : <Skeleton className="h-6 w-56" />}
        <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
        <div className="mt-6">{children}</div>
      </div>
    </SkeletonRegion>
  );
}

/** Campos de un formulario de una columna (login, alta de tienda, invitación). */
export function FieldsSkeleton({ fields = 3, title = true }: { fields?: number; title?: boolean }) {
  return (
    <SkeletonRegion>
      {title ? (
        <div className="mb-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
        </div>
      ) : null}
      <div className="space-y-4">
        {Array.from({ length: fields }, (_, f) => (
          <FieldSkeleton key={f} i={f} />
        ))}
        <Skeleton className="h-9 w-full" />
      </div>
    </SkeletonRegion>
  );
}
