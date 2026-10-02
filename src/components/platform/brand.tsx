import type { ReactNode } from "react";

import { BrandGlyph } from "@/app/_brand/glyph";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/version";

/*
 * Piezas de marca del sitio de la plataforma (BRAND §4, §6). El glifo sale
 * de `_brand/glyph.tsx` (SVG, el mismo trazo que el favicon y la imagen para
 * compartir): ninguna "e" de logo como texto vivo.
 */

/**
 * Archivo para display (h1/h2, precios de planes, wordmark). La variable
 * `--font-archivo` la define `(platform)/layout.tsx` con `next/font`; trae
 * su propio fallback ajustado, así que sin la fuente cae al sistema sin salto.
 */
export const DISPLAY = "font-[family-name:var(--font-archivo)]";

/** Eyebrow de sección: 12/500, mayúsculas, ámbar legible sobre claro (BRAND §6.2). */
export const EYEBROW = "text-[12px] font-medium tracking-[0.08em] uppercase text-adm-accent-2-ink";

/** H1 de landing (BRAND §6.2): Archivo 40 → 52 → 60 / 600, interlínea 1,02. */
export const H1 = cn(DISPLAY, "text-[40px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[52px] lg:text-[60px]");

/** H2 de landing: Archivo 30 → 36 / 600, interlínea 1,08. */
export const H2 = cn(DISPLAY, "text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[36px]");

/** Link dentro de texto: pino y siempre subrayado (el color solo no llega a 3:1 contra la tinta). */
export const TEXT_LINK = "font-medium text-adm-accent underline underline-offset-4 hover:no-underline";

/** CTA primario de landing: pino, 44 px, flecha opcional (BRAND §10). */
export const CTA_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-adm bg-adm-accent px-5 text-[15px] font-medium text-adm-accent-fg transition-colors duration-[120ms] hover:bg-adm-accent-hover";

/**
 * Tile de marca: cuadrado con la "e" ámbar al 62 % del lado y radio 18 %.
 * `tone="light"` (fondos claros) → tile tinta; `tone="dark"` (bandas tinta)
 * → tile pino, si no desaparece (BRAND §4.2).
 */
export function BrandMark({ size = 28, tone = "light", className }: { size?: number; tone?: "light" | "dark"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", tone === "dark" ? "bg-adm-sidebar-active" : "bg-adm-sidebar-bg", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.18) }}
    >
      <BrandGlyph size={Math.round(size * 0.62)} />
    </span>
  );
}

/** Lockup horizontal: tile + wordmark en Archivo 600, separación 0,36 × lado. */
export function BrandLockup({ tone = "light", size = 28, hideWordmarkOnMobile }: { tone?: "light" | "dark"; size?: number; hideWordmarkOnMobile?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: Math.round(size * 0.36) }}>
      <BrandMark size={size} tone={tone} />
      <span
        className={cn(
          DISPLAY,
          "text-[17px] leading-none font-semibold tracking-[-0.01em]",
          tone === "dark" ? "text-adm-sidebar-fg" : "text-adm-fg",
          hideWordmarkOnMobile && "max-sm:sr-only",
        )}
      >
        {APP_NAME}
      </span>
    </span>
  );
}

/** Error de formulario o de página: superficie de peligro con texto legible (sin hex sueltos). */
export function FormAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={cn("rounded-adm border border-adm-danger/30 bg-adm-danger-soft px-3 py-2 text-[13px] leading-relaxed text-adm-danger", className)}>
      {children}
    </p>
  );
}
