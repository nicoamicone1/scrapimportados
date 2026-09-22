import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { netPrice, priceWithDiscount } from "@/lib/pricing";

export interface PriceTagProps {
  price: number;
  compareAt?: number | null;
  /** "Desde" (variantes con precios distintos). */
  from?: boolean;
  /** % de descuento del mejor método de pago para la línea secundaria. */
  transferPercent?: number;
  /** "transferencia" → "$ X con transferencia". */
  transferLabel?: string;
  /** Precio sin impuestos nacionales (Ley 27.743): alícuota + leyenda. */
  net?: { vat: number; label: string } | null;
  size?: "sm" | "md" | "lg";
  currency?: string;
  locale?: string;
  /** Precio en gris (agotado). */
  muted?: boolean;
  /** Slot al lado de la línea de transferencia (ej. "Ver medios de pago"). */
  extra?: ReactNode;
  className?: string;
}

/**
 * Precio del storefront (DESIGN.md §6.2): actual en `--fg` (o `--accent` si
 * es promo) + anterior tachado + línea "con transferencia" + neto sin
 * impuestos. Siempre `--font-body` y `tabular-nums`. Nunca cuotas.
 * Sin hooks: se usa desde Server y Client Components.
 */
export function PriceTag({
  price,
  compareAt,
  from,
  transferPercent = 0,
  transferLabel = "transferencia",
  net,
  size = "md",
  currency,
  locale,
  muted,
  extra,
  className,
}: PriceTagProps) {
  const fmt = (v: number) => formatMoney(v, { currency, locale });
  // Las líneas secundarias son orientativas: sin centavos.
  const fmtRound = (v: number) => formatMoney(Math.round(v), { currency, locale, decimals: 0 });
  const onSale = !muted && compareAt != null && compareAt > price;
  const transferPrice = transferPercent > 0 && !muted ? priceWithDiscount(price, transferPercent) : null;
  const netValue = net ? netPrice(price, net.vat) : null;

  return (
    <div className={cn("tnum font-body", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        {from ? <span className="text-sm font-normal text-fg-muted">Desde</span> : null}
        <span
          className={cn(
            "font-semibold",
            size === "lg" ? "text-xl lg:text-2xl" : size === "md" ? "text-lg" : "text-base",
            muted ? "text-fg-muted" : onSale ? "text-accent" : "text-fg",
          )}
        >
          <span className="sr-only">Precio actual: </span>
          {fmt(price)}
        </span>
        {onSale ? (
          <s className="text-sm text-fg-muted">
            <span className="sr-only">Precio anterior: </span>
            {fmt(compareAt)}
          </s>
        ) : null}
      </div>
      {transferPrice != null ? (
        <p className={cn("text-fg-muted", size === "lg" ? "mt-1.5 text-sm" : "mt-0.5 text-xs")}>
          {size === "lg" ? (
            <>
              Pagando con {transferLabel} <strong className="font-semibold text-fg">{fmtRound(transferPrice)}</strong> (
              {transferPercent}&nbsp;% off)
            </>
          ) : (
            <>
              {fmtRound(transferPrice)} con {transferLabel}
            </>
          )}
          {extra ? <> · {extra}</> : null}
        </p>
      ) : extra ? (
        <p className="mt-1.5 text-sm text-fg-muted">{extra}</p>
      ) : null}
      {netValue != null && net ? (
        <p className={cn("text-fg-muted", size === "lg" ? "mt-1 text-xs" : "mt-0.5 text-[length:var(--text-xs)] leading-tight")}>
          {net.label}: {fmt(netValue)}
        </p>
      ) : null}
    </div>
  );
}
