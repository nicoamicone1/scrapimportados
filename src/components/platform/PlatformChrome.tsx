import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { storeHref } from "@/lib/tenant/urls";
import { APP_NAME, APP_VERSION } from "@/lib/version";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-[5px] bg-adm-sidebar-bg text-[14px] leading-none font-bold text-adm-accent-2",
        className,
      )}
    >
      e
    </span>
  );
}

/** Header de las páginas públicas de la plataforma (landing, planes). */
export function PlatformHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-adm-border bg-adm-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-[5px]">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{APP_NAME}</span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-5 text-[13px] text-adm-fg-muted sm:flex">
          <Link href="/planes" className="hover:text-adm-fg">
            Planes
          </Link>
          <Link href={storeHref({ slug: "demo" })} className="hover:text-adm-fg">
            Tienda demo
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link href="/app" className="inline-flex h-8 items-center rounded-adm px-3 text-sm font-medium text-adm-fg hover:bg-adm-surface-2">
              Mis tiendas
            </Link>
          ) : (
            <Link href="/login" className="inline-flex h-8 items-center rounded-adm px-3 text-sm font-medium text-adm-fg hover:bg-adm-surface-2">
              Ingresar
            </Link>
          )}
          <Link
            href={signedIn ? "/app/nueva" : "/registro"}
            className="inline-flex h-8 items-center rounded-adm bg-adm-accent px-3 text-sm font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
          >
            Creá tu tienda gratis
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PlatformFooter() {
  return (
    <footer className="border-t border-adm-border bg-adm-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-xs text-adm-fg-muted sm:px-6">
        <span className="flex items-center gap-2">
          <BrandMark className="size-5 text-[11px]" />
          <span className="tnum">
            {APP_NAME} {APP_VERSION}
          </span>
        </span>
        <Link href="/planes" className="hover:text-adm-fg">
          Planes
        </Link>
        <Link href={storeHref({ slug: "demo" })} className="hover:text-adm-fg">
          Tienda demo
        </Link>
        <Link href="/login" className="hover:text-adm-fg">
          Ingresar
        </Link>
        <span className="ml-auto">Hecho en Argentina. Cobrás por transferencia o WhatsApp, sin comisiones de pasarela.</span>
      </div>
    </footer>
  );
}

export function PlatformPage({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PlatformHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <PlatformFooter />
    </div>
  );
}
