import type { ReactNode } from "react";

import { BrandGlyph, bubbleRadii } from "@/app/_brand/glyph";
import { cn } from "@/lib/cn";
import { APP_NAME } from "@/lib/version";

/*
 * Piezas de marca del sitio de la plataforma y del panel (BRAND §4, §6). El glifo sale
 * de `_brand/glyph.tsx` (SVG, el mismo trazo que el favicon y la imagen para
 * compartir): ninguna "e" de logo como texto vivo.
 */

/**
 * Display de marca: Archivo expandida y pesada (`.eco-display`, globals.css).
 * La variable `--font-archivo` la define `_brand/fonts.ts` con `next/font` y
 * la aplican los layouts de la plataforma y del panel.
 */
export const DISPLAY = "eco-display";

/** Números de marca (precios de planes, métricas): Archivo expandida, tabulares. */
export const NUM = "eco-num";

/** Texto de la landing en Archivo de ancho normal (el panel sigue en la fuente del sistema). */
export const BODY = "font-[family-name:var(--eco-font-display)]";

/** Eyebrow de sección: 12/600, mayúsculas, pomelo legible sobre claro (BRAND §6.2). */
export const EYEBROW = "text-[12px] font-semibold tracking-[0.1em] uppercase text-adm-accent-2-ink";

/** H1 de landing (BRAND §6.2): display 44 → 60 → 76, interlínea 0,96. */
export const H1 = cn(DISPLAY, "text-[44px] leading-[0.96] sm:text-[60px] lg:text-[76px]");

/** H2 de landing: display 32 → 44, interlínea 1. */
export const H2 = cn(DISPLAY, "text-[32px] leading-none sm:text-[44px]");

/** Link dentro de texto: azul de interacción y siempre subrayado. */
export const TEXT_LINK = "font-medium text-adm-link underline decoration-2 underline-offset-4 hover:text-adm-link-hover";

/**
 * CTA de marca: pastilla pomelo con texto tinta, 48 px. La flecha (si la
 * lleva) va en un círculo tinta que se corre al hover: envolvela en
 * `<span className={CTA_ARROW}>`. Uno por vista.
 */
export const CTA_PRIMARY =
  "group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-eco-pomelo pr-2 pl-6 text-[15px] font-semibold text-eco-ink transition-[background-color,transform] duration-[240ms] ease-eco-out hover:bg-eco-pomelo-dark active:scale-[0.98]";

/** Círculo tinta de la flecha del CTA de marca. */
export const CTA_ARROW =
  "inline-flex size-8 items-center justify-center rounded-full bg-eco-ink text-white transition-transform duration-[420ms] ease-eco-spring group-hover:translate-x-1 group-hover:-rotate-45";

/** CTA secundario: pastilla con borde tinta; sobre bandas tinta usá `CTA_GHOST_DARK`. */
export const CTA_SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-eco-ink px-6 text-[15px] font-semibold text-eco-ink transition-colors duration-[240ms] ease-eco-out hover:bg-eco-ink hover:text-white";
export const CTA_GHOST_DARK =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 text-[15px] font-semibold text-white transition-colors duration-[240ms] ease-eco-out hover:border-white hover:bg-white hover:text-eco-ink";

/**
 * El logo: la burbuja pomelo con la "e" tinta (BRAND §4). Funciona igual
 * sobre claro y sobre tinta, así que `tone` ya no cambia el tile (se conserva
 * la prop por compatibilidad). `draw` dibuja el trazo al montar.
 */
export function BrandMark({ size = 28, className, draw }: { size?: number; tone?: "light" | "dark"; className?: string; draw?: boolean }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center bg-eco-pomelo", className)} style={{ width: size, height: size, ...bubbleRadii(size) }}>
      <BrandGlyph size={Math.round(size * 0.58)} draw={draw} />
    </span>
  );
}

/** Lockup horizontal: burbuja + wordmark en display, separación 0,32 × lado. */
export function BrandLockup({ tone = "light", size = 28, hideWordmarkOnMobile }: { tone?: "light" | "dark"; size?: number; hideWordmarkOnMobile?: boolean }) {
  return (
    <span className="inline-flex items-center" style={{ gap: Math.round(size * 0.32) }}>
      <BrandMark size={size} />
      <span
        className={cn(DISPLAY, "leading-none lowercase", tone === "dark" ? "text-white" : "text-eco-ink", hideWordmarkOnMobile && "max-sm:sr-only")}
        style={{ fontSize: Math.round(size * 0.72) }}
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
