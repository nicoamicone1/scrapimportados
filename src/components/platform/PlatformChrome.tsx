import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { storeHref } from "@/lib/tenant/urls";
import { APP_NAME, APP_VERSION } from "@/lib/version";

import { PLATFORM_EMAIL } from "./site";

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

const NAV = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/planes", label: "Planes" },
] as const;

/** Header de las páginas públicas de la plataforma (landing, planes, legales, contacto). */
export function PlatformHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-adm-border bg-adm-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-[5px]">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{APP_NAME}</span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-5 text-[13px] text-adm-fg-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-adm-fg">
              {item.label}
            </Link>
          ))}
          <Link href={storeHref({ slug: "demo" })} className="hover:text-adm-fg">
            Tienda demo
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            href={signedIn ? "/app" : "/login"}
            className="inline-flex h-9 items-center rounded-adm px-2.5 text-sm font-medium whitespace-nowrap text-adm-fg hover:bg-adm-surface-2 sm:h-8 sm:px-3"
          >
            {signedIn ? "Mis tiendas" : "Ingresar"}
          </Link>
          <Link
            href={signedIn ? "/app/nueva" : "/registro"}
            className="inline-flex h-9 items-center rounded-adm bg-adm-accent px-3 text-sm font-medium whitespace-nowrap text-adm-accent-fg hover:bg-adm-accent-hover sm:h-8"
          >
            <span className="sm:hidden">Crear tienda</span>
            <span className="hidden sm:inline">Crear tu tienda gratis</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-[12px] font-medium text-adm-sidebar-muted">{title}</h2>
      <ul className="mt-3 space-y-2 text-[13px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-adm-sidebar-fg underline-offset-4 hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pie de la plataforma: marca y contacto a la izquierda (columna ancha) y dos
 * listas cortas con sólo los links que existen. Banda `--adm-sidebar-bg`,
 * igual que el sidebar del panel.
 */
export function PlatformFooter({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <footer className="bg-adm-sidebar-bg text-adm-sidebar-fg">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-12 pb-8 sm:px-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-[360px]">
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-[5px]">
            <BrandMark className="bg-adm-sidebar-active" />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">{APP_NAME}</span>
          </Link>
          <p className="mt-3 text-[13px] leading-relaxed text-adm-sidebar-muted">
            Tiendas online para pymes argentinas. Cobrás por transferencia o WhatsApp, sin comisión por venta.
          </p>
          <p className="mt-4 text-[13px]">
            <a href={`mailto:${PLATFORM_EMAIL}`} className="font-medium text-adm-accent-2 underline-offset-4 hover:underline">
              {PLATFORM_EMAIL}
            </a>
          </p>
        </div>
        <FooterLinks
          title="Producto"
          links={[
            { href: "/#como-funciona", label: "Cómo funciona" },
            { href: "/planes", label: "Planes" },
            { href: storeHref({ slug: "demo" }), label: "Tienda demo" },
            signedIn ? { href: "/app", label: "Mis tiendas" } : { href: "/login", label: "Ingresar" },
          ]}
        />
        <FooterLinks
          title="Ayuda y legales"
          links={[
            { href: "/contacto", label: "Contacto" },
            { href: "/terminos", label: "Términos del servicio" },
            { href: "/privacidad", label: "Política de privacidad" },
          ]}
        />
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 border-t border-adm-sidebar-border px-4 py-4 text-[12px] text-adm-sidebar-muted sm:px-6">
        <span className="tnum">
          {APP_NAME} {APP_VERSION}
        </span>
        <span>Hecho en Argentina.</span>
      </div>
    </footer>
  );
}

export function PlatformPage({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PlatformHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <PlatformFooter signedIn={signedIn} />
    </div>
  );
}
