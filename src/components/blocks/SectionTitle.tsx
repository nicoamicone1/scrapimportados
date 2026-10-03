import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { slugify } from "@/lib/slug";

import { SmartLink } from "./Button";

/**
 * Encabezado de sección (DESIGN.md §2.7, §6.8): h2 + subtítulo muted y
 * "Ver todo" como link de texto. La forma la decide `theme.style.titles`
 * en `blocks.css` (`.blk-sectitle` dentro de `[data-titles]`):
 *   plain · rule (regla gruesa arriba) · centered (centrado entre filetes)
 *   · index (numerado 01/02, como revista) · tag (etiqueta del color primario).
 */
export function SectionTitle({
  title,
  subtitle,
  href,
  hrefLabel = "Ver todo",
  arrow,
  aside,
  className,
  anchor,
}: {
  title?: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  /** Flecha "→" (sólo en el preset editorial). */
  arrow?: boolean;
  /** Contenido extra a la derecha (flechas del slider). */
  aside?: ReactNode;
  className?: string;
  /** Usar el título como ancla (`/#como-comprar`). */
  anchor?: boolean;
}) {
  if (!title && !href && !aside) return null;
  return (
    <div className={cn("blk-head", className)}>
      <div className="blk-head-main">
        {title ? (
          <h2 className="blk-title blk-sectitle" id={anchor ? slugify(title) || undefined : undefined}>
            <span>{title}</span>
          </h2>
        ) : null}
        {subtitle ? <p className="blk-head-sub">{subtitle}</p> : null}
      </div>
      {href || aside ? (
        <div className="blk-head-aside">
          {href ? (
            <SmartLink href={href} className="blk-link st-link">
              {hrefLabel}
              {arrow ? " →" : null}
            </SmartLink>
          ) : null}
          {aside}
        </div>
      ) : null}
    </div>
  );
}
