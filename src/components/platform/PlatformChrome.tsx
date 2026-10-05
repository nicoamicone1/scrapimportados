import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { storeHref } from "@/lib/tenant/urls";
import { APP_NAME, APP_VERSION } from "@/lib/version";

import { BrandLockup, BrandMark, CTA_ARROW, CTA_PRIMARY, DISPLAY } from "./brand";
import { MobileMenu, ScrollAwareHeader } from "./PlatformChromeClient";
import { PLATFORM_EMAIL } from "./site";

/** Tile de marca (SVG). Se re-exporta para quien ya lo importaba de acá (AppHeader). */
export { BrandMark };

function navLinks() {
  return [
    { href: "/#como-funciona", label: "Cómo funciona" },
    { href: "/#probar", label: "Estilos" },
    { href: "/planes", label: "Planes" },
    { href: "/ayuda", label: "Ayuda" },
    { href: storeHref({ slug: "demo" }), label: "Tienda demo" },
  ];
}

/** Lockup del header: la "e" se dibuja al cargar (BRAND §4.3). */
function HeaderLockup() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={32} draw />
      <span className={cn(DISPLAY, "text-[23px] leading-none text-eco-ink lowercase")}>{APP_NAME}</span>
    </span>
  );
}

/**
 * Header del sitio público (landing, planes, ayuda, guías, legales, contacto).
 * Arriba de todo es una barra ancha y transparente con la navegación en una
 * pastilla blanca; al scrollear se compacta en una sola pastilla flotante
 * (`data-scrolled`, landing.css). El CTA de marca queda a un toque siempre.
 * En el celular: logo, CTA corto y el menú en hoja (`MobileMenu`).
 */
export function PlatformHeader({ signedIn }: { signedIn: boolean }) {
  const links = navLinks();
  const start = signedIn ? "/app/nueva" : "/registro";
  const account = signedIn ? { href: "/app", label: "Mis tiendas" } : { href: "/login", label: "Ingresar" };
  return (
    <ScrollAwareHeader className="lp-header sticky top-0 z-40 px-3 pt-2 sm:px-4 sm:pt-3">
      <div className="lp-header-bar relative mx-auto flex items-center gap-2 rounded-full px-1 sm:gap-3 sm:px-3">
        <Link href="/" aria-label={`${APP_NAME}, inicio`} className="flex shrink-0 items-center rounded-full p-1">
          <HeaderLockup />
        </Link>
        <nav
          aria-label="Principal"
          className="lp-header-nav mx-auto hidden items-center gap-0.5 rounded-full bg-eco-paper p-1 shadow-[0_0_0_1px_var(--eco-line)] lg:flex"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap text-eco-ink transition-colors duration-[140ms] hover:bg-eco-niebla-2 lg:px-4"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-0">
          <Link
            href={account.href}
            className="hidden h-11 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap text-eco-ink transition-colors duration-[140ms] hover:bg-eco-niebla-2 lg:inline-flex"
          >
            {account.label}
          </Link>
          <Link href={start} className={cn(CTA_PRIMARY, "h-11 pl-4 text-[14px] max-[359px]:pr-4 sm:pl-5")}>
            <span className="whitespace-nowrap">{signedIn ? "Crear tienda" : <>Crear tienda<span className="max-sm:hidden"> gratis</span></>}</span>
            <span className={cn(CTA_ARROW, "size-7 max-[359px]:hidden")}>
              <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
            </span>
          </Link>
          <MobileMenu links={links} account={account} cta={{ href: start, label: signedIn ? "Crear una tienda" : "Crear tu tienda gratis" }} />
        </div>
      </div>
    </ScrollAwareHeader>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-[12px] font-semibold tracking-[0.1em] text-eco-bruma uppercase">{title}</h2>
      <ul className="mt-3 text-[15px] md:space-y-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex min-h-11 items-center text-eco-mist decoration-eco-pomelo decoration-2 underline-offset-4 hover:text-white hover:underline md:min-h-8"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pie de la plataforma: hoja tinta con esquinas de 32 px (BRAND §7.2), marca
 * y contacto, tres listas cortas y el wordmark gigante cortado por el borde.
 * `overlap`: la hoja "entra" sobre la sección anterior (la landing deja el
 * lugar con `.lp-under-sheet`); en el resto de las páginas va a continuación.
 */
export function PlatformFooter({ signedIn = false, overlap = false }: { signedIn?: boolean; overlap?: boolean }) {
  return (
    <footer className={cn("relative z-10 overflow-hidden rounded-t-[32px] bg-eco-ink text-eco-mist", overlap ? "lp-sheet" : "mt-8")}>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-14 pb-4 sm:px-6 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] md:pt-20">
        <div className="max-w-[380px]">
          <Link href="/" aria-label={`${APP_NAME}, inicio`} className="inline-flex items-center rounded-full">
            <BrandLockup tone="dark" size={36} />
          </Link>
          <p className="mt-5 text-[15px] leading-relaxed text-eco-bruma">
            Tiendas online para pymes argentinas, con tu marca. Cobrás por transferencia o con tu cuenta de Mercado Pago, y Ecommy no cobra
            comisión por venta.
          </p>
          <p className="mt-5 text-[15px]">
            <a
              href={`mailto:${PLATFORM_EMAIL}`}
              className="inline-flex min-h-11 items-center font-semibold text-eco-azul-light underline decoration-2 underline-offset-4 hover:text-white"
            >
              {PLATFORM_EMAIL}
            </a>
          </p>
        </div>
        <FooterLinks
          title="Producto"
          links={[
            { href: "/#como-funciona", label: "Cómo funciona" },
            { href: "/#probar", label: "Estilos por rubro" },
            { href: "/planes", label: "Planes" },
            { href: storeHref({ slug: "demo" }), label: "Tienda demo" },
          ]}
        />
        <FooterLinks
          title="Ayuda"
          links={[
            { href: "/ayuda", label: "Centro de ayuda" },
            { href: "/guias", label: "Guías" },
            { href: "/contacto", label: "Contacto" },
            signedIn ? { href: "/app", label: "Mis tiendas" } : { href: "/login", label: "Ingresar" },
          ]}
        />
        <FooterLinks
          title="Legales"
          links={[
            { href: "/terminos", label: "Términos del servicio" },
            { href: "/privacidad", label: "Política de privacidad" },
          ]}
        />
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-8 text-[13px] text-eco-bruma sm:px-6">
        <span className="tnum">
          {APP_NAME} {APP_VERSION}
        </span>
        <span aria-hidden>·</span>
        <span>Hecho en Argentina.</span>
      </div>
      <div aria-hidden className="mx-auto mt-6 flex max-w-7xl items-end gap-[2.5vw] overflow-hidden px-4 sm:px-6">
        <p className={cn(DISPLAY, "lp-footer-word translate-y-[16%] text-white lowercase select-none")}>{APP_NAME}</p>
        <span className="mb-[3vw] hidden shrink-0 sm:block">
          <BrandMark size={96} />
        </span>
      </div>
    </footer>
  );
}

export function PlatformPage({
  signedIn,
  children,
  footerOverlap,
  className,
}: {
  signedIn: boolean;
  children: ReactNode;
  /** La landing termina en una hoja de color: el pie entra sobre ella (BRAND §7.2). */
  footerOverlap?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-h-dvh flex-col bg-eco-niebla text-eco-ink", className)}>
      <PlatformHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <PlatformFooter signedIn={signedIn} overlap={footerOverlap} />
    </div>
  );
}
