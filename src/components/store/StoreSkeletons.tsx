import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Skeletons del storefront (spec §14.5): neutros, con los tokens del TEMA
 * (`.sk` usa `--border` mezclado con `--bg`; radios `rounded-sm|md|lg` del
 * tema). Imitan el layout real de cada página; nada de spinners centrados.
 */

function Sk({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn("sk rounded-sm", className)} style={style} />;
}

function Region({ children, label = "Cargando…", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

function Breadcrumb() {
  return (
    <div className="flex gap-2">
      <Sk className="h-3 w-12" />
      <Sk className="h-3 w-20" />
    </div>
  );
}

/** Card de producto: media con el ratio del tema + nombre + precio. */
function CardSkeleton({ i }: { i: number }) {
  return (
    <div>
      <Sk className="pcard-media w-full rounded-lg" />
      <Sk className={cn("mt-3 h-3.5", i % 3 === 0 ? "w-[80%]" : i % 3 === 1 ? "w-[65%]" : "w-[72%]")} />
      <Sk className="mt-2 h-3.5 w-[40%]" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, columns = 3 }: { count?: number; columns?: number }) {
  return (
    <div className="store-grid" style={{ "--cols": columns } as CSSProperties}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} i={i} />
      ))}
    </div>
  );
}

/** Listado / categoría: breadcrumb, título, barra (cantidad + filtros + orden), filtros a la izquierda y grilla. */
export function CatalogSkeleton() {
  return (
    <Region className="store-container py-[var(--space-section-sm)]" label="Cargando productos…">
      <Breadcrumb />
      <Sk className="mt-4 h-8 w-56 max-w-[70%]" />
      <div className="mt-6 flex items-center justify-between gap-3 border-b border-border pb-3">
        <Sk className="h-3.5 w-24" />
        <div className="flex gap-2">
          <Sk className="h-10 w-24 rounded-md lg:hidden" />
          <Sk className="h-10 w-40 rounded-md" />
        </div>
      </div>
      <div className="mt-7 grid gap-8 lg:grid-cols-12">
        <div className="hidden space-y-5 lg:col-span-3 lg:block xl:col-span-2">
          {Array.from({ length: 4 }, (_, g) => (
            <div key={g} className="space-y-2.5 border-b border-border pb-4">
              <Sk className="h-4 w-24" />
              <Sk className="h-3 w-[80%]" />
              <Sk className="h-3 w-[60%]" />
              <Sk className="h-3 w-[70%]" />
            </div>
          ))}
        </div>
        <div className="min-w-0 lg:col-span-9 xl:col-span-10">
          <ProductGridSkeleton count={9} />
        </div>
      </div>
    </Region>
  );
}

/** Ficha de producto: galería (7/12) + información y compra (5/12). */
export function ProductSkeleton() {
  return (
    <Region className="store-container py-[var(--space-section-sm)]" label="Cargando producto…">
      <Breadcrumb />
      <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:gap-12">
        {/* Mismo límite de alto que ProductGallery (DESIGN.md §6.3) para que no salte al cargar. */}
        <div
          className="lg:col-span-7 lg:flex lg:justify-center lg:gap-4"
          style={{ "--pdp-media-h": "clamp(400px, calc(100svh - var(--header-h, 68px) - 128px), 680px)" } as CSSProperties}
        >
          <div className="hidden w-20 shrink-0 flex-col gap-2 lg:flex">
            {Array.from({ length: 4 }, (_, i) => (
              <Sk key={i} className="aspect-square w-full" />
            ))}
          </div>
          <Sk className="pcard-media w-full rounded-lg lg:max-w-[calc(var(--pdp-media-h)*var(--card-ratio,1/1))] lg:min-w-0 lg:flex-1" />
        </div>
        <div className="lg:col-span-5">
          <Sk className="h-3 w-24" />
          <Sk className="mt-3 h-8 w-[85%]" />
          <Sk className="mt-2 h-8 w-[55%]" />
          <Sk className="mt-6 h-7 w-36" />
          <Sk className="mt-2 h-3.5 w-48" />
          <div className="mt-8 space-y-2">
            <Sk className="h-3.5 w-20" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Sk key={i} className="h-10 w-14 rounded-md" />
              ))}
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <Sk className="h-12 w-32 rounded-md" />
            <Sk className="h-12 flex-1 rounded-md" />
          </div>
          <div className="mt-8 space-y-2 border-t border-border pt-5">
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-[92%]" />
            <Sk className="h-3 w-[70%]" />
          </div>
        </div>
      </div>
    </Region>
  );
}

function SummaryBox({ rows = 4, button = true }: { rows?: number; button?: boolean }) {
  return (
    <div className="h-fit space-y-4 rounded-lg border border-border bg-surface p-5">
      <Sk className="h-5 w-28" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex justify-between gap-6">
          <Sk className="h-3.5 w-24" />
          <Sk className="h-3.5 w-16" />
        </div>
      ))}
      <div className="flex justify-between gap-6 border-t border-border pt-4">
        <Sk className="h-5 w-16" />
        <Sk className="h-5 w-24" />
      </div>
      {button ? <Sk className="h-12 w-full rounded-md" /> : null}
    </div>
  );
}

function LineSkeleton({ i }: { i: number }) {
  return (
    <div className="flex gap-4 border-b border-border py-4 last:border-b-0">
      <Sk className="size-20 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <Sk className={cn("h-3.5", i % 2 ? "w-[60%]" : "w-[75%]")} />
        <Sk className="mt-2 h-3 w-24" />
        <Sk className="mt-4 h-9 w-28 rounded-md" />
      </div>
      <Sk className="h-4 w-16" />
    </div>
  );
}

/** Carrito: líneas (7/12) + resumen (5/12). */
export function CartSkeleton() {
  return (
    <Region className="store-container py-[var(--space-section-sm)]" label="Cargando el carrito…">
      <Sk className="h-8 w-40" />
      <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="border-y border-border lg:col-span-7 xl:col-span-8">
          {Array.from({ length: 3 }, (_, i) => (
            <LineSkeleton key={i} i={i} />
          ))}
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <SummaryBox />
        </div>
      </div>
    </Region>
  );
}

/** Checkout: pasos con campos (560px) + resumen (380px). */
export function CheckoutSkeleton() {
  return (
    <Region className="store-container py-[var(--space-section-sm)]" label="Cargando el checkout…">
      <Sk className="h-8 w-48" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,560px)_380px] lg:justify-between">
        <div className="space-y-8">
          {Array.from({ length: 3 }, (_, s) => (
            <div key={s} className="space-y-4">
              <Sk className="h-5 w-40" />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: s === 1 ? 2 : 4 }, (_, f) => (
                  <div key={f} className="space-y-2">
                    <Sk className="h-3 w-20" />
                    <Sk className="h-11 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SummaryBox rows={3} button={false} />
      </div>
    </Region>
  );
}

/** Estado de un pedido (/pedido/[token]). */
export function OrderStatusSkeleton() {
  return (
    <Region className="store-container max-w-[calc(880px+2*var(--gutter))] py-[var(--space-section-sm)]" label="Cargando tu pedido…">
      <Sk className="h-3 w-24" />
      <Sk className="mt-3 h-8 w-72 max-w-[80%]" />
      <Sk className="mt-3 h-3.5 w-[60%]" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Sk key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {Array.from({ length: 3 }, (_, i) => (
            <LineSkeleton key={i} i={i} />
          ))}
        </div>
        <div className="lg:col-span-5">
          <SummaryBox rows={3} button={false} />
        </div>
      </div>
    </Region>
  );
}

/** Página del builder (/[slug]): banda de portada + texto. */
export function ContentPageSkeleton() {
  return (
    <Region label="Cargando…">
      <Sk className="h-[38vh] min-h-56 w-full rounded-none" />
      <div className="store-container py-[var(--space-section-sm)]">
        <Sk className="h-8 w-80 max-w-[80%]" />
        <div className="mt-6 max-w-[68ch] space-y-2.5">
          <Sk className="h-3.5 w-full" />
          <Sk className="h-3.5 w-[94%]" />
          <Sk className="h-3.5 w-[88%]" />
          <Sk className="h-3.5 w-[60%]" />
        </div>
        <div className="mt-10">
          <ProductGridSkeleton count={4} columns={4} />
        </div>
      </div>
    </Region>
  );
}
