import Link from "next/link";
import type { ReactNode } from "react";

import { APP_NAME, APP_VERSION } from "@/lib/version";

/**
 * Marco de las pantallas sin sesión (login, registro, reset, onboarding):
 * formulario sobre superficie blanca a la izquierda y, en desktop, panel pino
 * con una frase corta y un mock del storefront hecho con CSS (spec §14.6).
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
        <header className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-7 items-center justify-center rounded-[5px] bg-adm-sidebar-bg text-[14px] leading-none font-bold text-adm-accent-2"
          >
            e
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-[-0.01em]">{APP_NAME}</div>
            {storeName && storeName !== APP_NAME ? <div className="text-xs text-adm-fg-muted">{storeName}</div> : null}
          </div>
        </header>

        <div className="w-full max-w-[380px] py-12">
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

      <aside className="relative hidden overflow-hidden bg-adm-accent text-white md:flex md:flex-col md:justify-between md:px-12 md:py-12 lg:px-16">
        <div className="max-w-[440px]">
          <p className="text-[11px] font-medium tracking-[0.08em] text-[#e8b574] uppercase">Panel de tu tienda</p>
          <p className="mt-3 text-[26px] leading-[1.2] font-semibold tracking-[-0.015em]">
            {panelTitle ?? "Catálogo, precios y pedidos en un solo lugar. Tu tienda sale con tu marca."}
          </p>
          {aside ? <p className="tnum mt-4 text-sm text-[#cfe0d7]">{aside}</p> : null}
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
      <div className="overflow-hidden rounded-[8px] bg-[#f7f4ee] text-adm-fg shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] ring-1 ring-black/10">
        {/* barra del navegador */}
        <div className="flex h-8 items-center gap-3 border-b border-[#e2dbcd] bg-white px-3">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-[#e2dbcd]" />
            <span className="size-2 rounded-full bg-[#e2dbcd]" />
            <span className="size-2 rounded-full bg-[#e2dbcd]" />
          </span>
          <span className="h-5 flex-1 rounded-[4px] bg-[#f4f1ea] px-2 text-[10px] leading-5 text-adm-fg-muted">tutienda.ecommy.app</span>
        </div>
        {/* header de la tienda */}
        <div className="flex items-center justify-between border-b border-[#e2dbcd] bg-white px-5 py-3">
          <span className="text-[13px] font-semibold tracking-[0.04em] uppercase">Lapacho</span>
          <span className="flex gap-3">
            <span className="h-1.5 w-8 rounded-full bg-[#d9d2c3]" />
            <span className="h-1.5 w-10 rounded-full bg-[#d9d2c3]" />
            <span className="h-1.5 w-7 rounded-full bg-[#d9d2c3]" />
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
              <span className={`mt-2 block h-1.5 rounded-full bg-[#d9d2c3] ${p.name}`} />
              <span className="tnum mt-1.5 block text-[10px] font-semibold">{p.price}</span>
            </div>
          ))}
        </div>
      </div>
      {/* aviso de pedido nuevo (lo que ve el dueño en el panel) */}
      <div className="absolute -top-5 -left-8 flex items-center gap-2.5 rounded-[6px] bg-adm-sidebar-bg px-3 py-2 text-[12px] text-adm-sidebar-fg shadow-[0_12px_24px_-12px_rgb(0_0_0/0.5)] ring-1 ring-white/10">
        <span className="size-1.5 rounded-full bg-adm-accent-2" />
        <span className="tnum">
          Pedido <span className="font-semibold text-white">#1043</span> · $ 48.500 · Transferencia
        </span>
      </div>
    </div>
  );
}
