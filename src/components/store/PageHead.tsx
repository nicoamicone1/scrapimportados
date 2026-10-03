import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/money";

/**
 * Encabezado de página del chrome (catálogo, carrito, checkout, pedido…). La
 * voz la pone `theme.style.titles`, vía `[data-titles]` en `.store-root`
 * (store.css, "Títulos"), igual que los títulos de sección de los bloques:
 * - `plain`    título solo.
 * - `rule`     título + regla fina que corre hasta el borde.
 * - `centered` centrado, con el eyebrow arriba en versalitas.
 * - `index`    el número (`count`) va volado como índice de revista: "Remeras ⁽¹²⁴⁾".
 * - `tag`      el eyebrow es una etiqueta (pastilla) arriba del título.
 * Sin `eyebrow`, el eyebrow no se dibuja en ningún estilo.
 */
export function PageHead({
  title,
  eyebrow,
  count,
  description,
  children,
  className,
  as: Tag = "h1",
  id,
}: {
  title: ReactNode;
  eyebrow?: string;
  /** Cantidad (productos, ítems): en `index` va volada junto al título. */
  count?: number;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <header className={cn("st-head", className)}>
      {eyebrow ? <p className="st-head-eyebrow">{eyebrow}</p> : null}
      <div className="st-head-row">
        <Tag id={id} className={cn("st-head-title", Tag === "h1" ? "h-page" : "h-section")}>
          {title}
          {count != null ? (
            <sup className="st-head-count tnum" aria-hidden>
              {formatNumber(count)}
            </sup>
          ) : null}
        </Tag>
      </div>
      {description ? <div className="st-head-desc">{description}</div> : null}
      {children}
    </header>
  );
}
