"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CTA_ARROW, CTA_PRIMARY, DISPLAY } from "./brand";

/**
 * `<header>` que sabe si la página se scrolleó (sin listener de scroll: un
 * centinela de 1 px arriba de todo y un IntersectionObserver). El estado va
 * como `data-scrolled` y lo dibuja `landing.css` (la barra se compacta en una
 * pastilla flotante). Sin JS se ve la barra completa, que también sirve.
 */
export function ScrollAwareHeader({ className, children }: { className?: string; children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute top-0 left-0 h-6 w-px" />
      <header className={className} data-scrolled={scrolled ? "" : undefined}>
        {children}
      </header>
    </>
  );
}

export interface MenuLink {
  href: string;
  label: string;
}

/**
 * Menú del celular: botón de 44 px que abre una hoja con los links grandes
 * y el CTA de marca al pie. Esc o un toque afuera la cierran y el foco
 * vuelve al botón; tocar un link también la cierra (los anclas de la misma
 * página no navegan).
 */
export function MobileMenu({ links, account, cta }: { links: readonly MenuLink[]; account: MenuLink; cta: MenuLink }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full text-eco-ink transition-colors duration-[140ms] hover:bg-eco-niebla-2"
      >
        {open ? <X className="size-5" strokeWidth={1.75} aria-hidden /> : <Menu className="size-5" strokeWidth={1.75} aria-hidden />}
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
      </button>
      {open ? (
        <div
          ref={panel}
          id={id}
          className="lp-menu-sheet absolute inset-x-3 top-[calc(100%+8px)] sm:left-auto sm:w-[380px] z-50 overflow-hidden rounded-[28px] bg-eco-paper p-2 shadow-[0_0_0_1px_var(--eco-line),0_28px_60px_-24px_rgb(16_22_47/0.45)]"
        >
          <nav aria-label="Principal (celular)">
            <ul>
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(DISPLAY, "flex min-h-14 items-center justify-between rounded-[20px] px-4 text-[22px] text-eco-ink hover:bg-eco-niebla")}
                  >
                    {l.label}
                    <ArrowRight className="size-4 text-eco-pomelo-ink" strokeWidth={1.75} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-2 grid gap-2 rounded-[22px] bg-eco-niebla p-2">
            <Link href={cta.href} onClick={() => setOpen(false)} className={cn(CTA_PRIMARY, "w-full justify-between")}>
              {cta.label}
              <span className={CTA_ARROW}>
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
            </Link>
            <Link
              href={account.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center justify-center rounded-full text-[15px] font-semibold text-eco-ink hover:bg-eco-niebla-2"
            >
              {account.label}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
