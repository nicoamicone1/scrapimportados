import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { archivo } from "@/app/_brand/fonts";
import { BrandLockup, CTA_ARROW, CTA_PRIMARY, DISPLAY } from "@/components/platform/brand";
import { cn } from "@/lib/cn";

import { Rings } from "./site-shapes";

/*
 * Pantalla de "no está" (404 raíz y tienda inexistente). Vive fuera de los
 * layouts de la plataforma y del panel, así que trae su propia fuente y sólo
 * usa primitivos `--eco-*` (globals.css). La burbuja dice "404" como un
 * mensaje: el error se cuenta con la forma de la marca, sin ilustraciones.
 */
export function NotFoundView({
  home,
  title,
  line,
  primary,
  links,
}: {
  /** Inicio de la plataforma (en el host de una tienda, la URL absoluta). */
  home: string;
  title: ReactNode;
  line: ReactNode;
  primary: { href: string; label: string };
  links: { href: string; label: string }[];
}) {
  return (
    <div className={cn(archivo.variable, "relative flex min-h-dvh flex-col overflow-hidden bg-eco-niebla font-[family-name:var(--eco-font-display)] text-eco-ink")}>
      <Rings size={1100} count={8} className="-right-[520px] -bottom-[560px] text-eco-pomelo/25" />
      <header className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <a href={home} aria-label="Ecommy, inicio" className="inline-flex rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-eco-azul">
          <BrandLockup size={30} />
        </a>
      </header>
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-12 px-4 pb-20 sm:px-6 md:flex-row md:items-center md:gap-20">
        <div aria-hidden className="eco-pop shrink-0">
          <div className="eco-bubble flex h-[180px] w-[260px] items-center justify-center bg-eco-pomelo [--eco-bubble-r:56px] sm:h-[240px] sm:w-[340px]">
            <span className={cn(DISPLAY, "eco-num text-[96px] leading-none tracking-[-0.06em] sm:text-[128px]")}>404</span>
          </div>
          <div className="mt-3 ml-1 flex gap-1.5">
            <span className="eco-float size-3 rounded-full bg-eco-ink" />
            <span className="eco-float size-3 rounded-full bg-eco-ink/60 [--i:1]" />
            <span className="eco-float size-3 rounded-full bg-eco-ink/30 [--i:2]" />
          </div>
        </div>
        <div className="eco-pop max-w-[34rem] [--i:2]">
          <p className="text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo-ink uppercase">Error 404</p>
          <h1 className={cn(DISPLAY, "mt-3 text-[40px] leading-[1] text-balance sm:text-[56px]")}>{title}</h1>
          <p className="mt-5 text-[18px] leading-relaxed text-eco-text-muted">{line}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href={primary.href} className={CTA_PRIMARY}>
              {primary.label}
              <span className={CTA_ARROW}>
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </span>
            </a>
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="inline-flex min-h-11 items-center text-[15px] font-semibold text-eco-azul underline decoration-2 underline-offset-4 hover:text-eco-azul-dark"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
