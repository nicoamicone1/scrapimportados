import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/platform/brand";
import { APP_NAME, APP_VERSION } from "@/lib/version";

/**
 * Marco de las pantallas sin sesión (login, registro, reset, onboarding):
 * formulario sobre superficie blanca a la izquierda y, en desktop, banda tinta
 * (BRAND §5.2: el pino es para lo accionable, no para fondos grandes) con una
 * frase corta y un mock del storefront hecho con CSS (spec §14.6).
 *
 * - `title` / `subtitle`: encabezado del formulario (opcional: los forms que
 *   ya traen su `<h1>` no lo pasan).
 * - `aside`: dato real debajo de la frase ("699 productos publicados").
 * - `storeName`: nombre bajo la marca (el panel de una tienda); si falta, sólo "Ecommy".
 * - `panelTitle`: reemplaza la frase del panel (ej. en el onboarding).
 */
export function AuthLayout({
  title,
  subtitle,
  aside,
  storeName,
  panelTitle,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  storeName?: string;
  panelTitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-adm-surface md:grid-cols-[minmax(440px,540px)_1fr]">
      <section className="flex flex-col justify-between px-6 py-6 sm:px-12 md:py-8">
        <header>
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-adm" aria-label={`${APP_NAME}, ir al inicio`}>
            <BrandMark size={28} />
            <span className="leading-tight">
              <span className="block text-[17px] leading-5 font-semibold tracking-[-0.01em] text-adm-fg">{APP_NAME}</span>
              {storeName && storeName !== APP_NAME ? <span className="block text-xs text-adm-fg-muted">{storeName}</span> : null}
            </span>
          </Link>
        </header>

        <div className="w-full max-w-[380px] py-10 md:py-12">
          {title ? (
            <div className="mb-6">
              <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em]">{title}</h1>
              {subtitle ? <p className="mt-1.5 text-sm text-adm-fg-muted">{subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </div>

        <footer className="flex items-center gap-3 text-xs text-adm-fg-muted">
          <span className="tnum">
            {APP_NAME} {APP_VERSION}
          </span>
          <span aria-hidden>·</span>
          <Link href="/" className="hover:text-adm-fg hover:underline">
            Inicio
          </Link>
          <span aria-hidden>·</span>
          <Link href="/planes" className="hover:text-adm-fg hover:underline">
            Planes
          </Link>
        </footer>
      </section>

      <aside className="relative hidden overflow-hidden bg-eco-ink text-eco-mist md:flex md:flex-col md:justify-between md:px-12 md:py-12 lg:px-16">
        <div className="max-w-[440px]">
          <p className="text-[12px] font-medium tracking-[0.08em] text-eco-amber uppercase">Panel de tu tienda</p>
          <p className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-[-0.015em] text-white">
            {panelTitle ?? "Catálogo, precios y pedidos en un solo lugar. Tu tienda sale con tu marca."}
          </p>
          {aside ? <p className="tnum mt-4 text-sm text-eco-sage">{aside}</p> : null}
        </div>
        <StorefrontMock />
      </aside>
    </div>
  );
}

/** Mock del storefront (sólo CSS, sin imágenes): navegador + tienda + aviso de pedido. */
function StorefrontMock() {
  const products = [
    { tone: "#d9c7a7", name: "w-20", price: "$ 48.500" },
    { tone: "#9fb3a6", name: "w-16", price: "$ 32.900" },
    { tone: "#c98f6b", name: "w-24", price: "$ 27.400" },
  ];
  return (
    <div aria-hidden className="relative mt-10 w-full max-w-[560px] translate-x-6 self-end lg:translate-x-10">
      <div className="overflow-hidden rounded-eco-lg bg-adm-table-head text-adm-fg ring-1 ring-white/10">
        {/* barra del navegador */}
        <div className="flex h-8 items-center gap-3 border-b border-adm-border bg-adm-surface px-3">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-adm-border" />
            <span className="size-2 rounded-full bg-adm-border" />
            <span className="size-2 rounded-full bg-adm-border" />
          </span>
          <span className="h-5 flex-1 rounded-adm-sm bg-adm-surface-2 px-2 text-[10px] leading-5 text-adm-fg-muted">tutienda.ecommy.app</span>
        </div>
        {/* header de la tienda */}
        <div className="flex items-center justify-between border-b border-adm-border bg-adm-surface px-5 py-3">
          <span className="text-[13px] font-semibold tracking-[0.04em] uppercase">Lapacho</span>
          <span className="flex gap-3">
            <span className="h-1.5 w-8 rounded-full bg-adm-border" />
            <span className="h-1.5 w-10 rounded-full bg-adm-border" />
            <span className="h-1.5 w-7 rounded-full bg-adm-border" />
          </span>
        </div>
        {/* hero */}
        <div className="grid grid-cols-[1.1fr_1fr] gap-4 px-5 py-5">
          <div className="flex flex-col justify-center">
            <span className="text-[15px] leading-tight font-semibold">Mesas de lapacho hechas en Misiones</span>
            <span className="mt-1.5 text-[11px] text-adm-fg-muted">8 modelos · envío a todo el país</span>
            <span className="mt-3 inline-flex h-6 w-fit items-center rounded-[4px] bg-adm-sidebar-bg px-2.5 text-[10px] font-medium text-white">
              Ver colección
            </span>
          </div>
          <div className="h-24 rounded-[6px] bg-[#b98a5e]" />
        </div>
        {/* grilla */}
        <div className="grid grid-cols-3 gap-3 px-5 pb-5">
          {products.map((p) => (
            <div key={p.price}>
              <div className="aspect-[4/5] rounded-[6px]" style={{ background: p.tone }} />
              <span className={`mt-2 block h-1.5 rounded-full bg-adm-border ${p.name}`} />
              <span className="tnum mt-1.5 block text-[10px] font-semibold">{p.price}</span>
            </div>
          ))}
        </div>
      </div>
      {/* aviso de pedido nuevo (lo que ve el dueño en el panel) */}
      <div className="absolute -top-5 -left-8 flex items-center gap-2.5 rounded-adm bg-eco-pine px-3 py-2 text-[12px] text-eco-mist ring-1 ring-white/10">
        <span className="size-1.5 rounded-full bg-adm-accent-2" />
        <span className="tnum">
          Pedido <span className="font-semibold text-white">#1043</span> · $ 48.500 · Transferencia
        </span>
      </div>
    </div>
  );
}
