import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { SmartLink } from "./Button";

/**
 * Encabezado de sección: h2 a la izquierda + subtítulo muted; "Ver todo"
 * como link de texto en la misma línea base (DESIGN.md §2.7, §6.8).
 */
export function SectionTitle({
  title,
  subtitle,
  href,
  hrefLabel = "Ver todo",
  arrow,
  aside,
  className,
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
}) {
  if (!title && !href && !aside) return null;
  return (
    <div className={cn("blk-head flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {title ? <h2 className="blk-title">{title}</h2> : null}
        {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {href || aside ? (
        <div className="flex shrink-0 items-center gap-4">
          {href ? (
            <SmartLink href={href} className="blk-link">
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
