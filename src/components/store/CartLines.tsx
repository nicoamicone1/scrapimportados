"use client";

import Image from "next/image";

import { StoreLink } from "@/components/store/StoreLink";
import type { CartItem } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { CartLine, CartTotals } from "@/lib/pricing";

import { QtyStepper } from "./QtyStepper";

/** Filas del carrito (drawer y página): miniatura · nombre + variante · stepper · precio. */
export function CartLines({
  items,
  lines,
  onQty,
  onRemove,
  onNavigate,
  size = "sm",
}: {
  items: CartItem[];
  lines: CartLine[];
  onQty: (variantId: string, qty: number) => void;
  onRemove: (variantId: string) => void;
  onNavigate?: () => void;
  size?: "sm" | "md";
}) {
  const byVariant = new Map(lines.map((l) => [l.variantId, l]));
  const thumb = size === "sm" ? "size-16" : "size-20 sm:size-24";
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const line = byVariant.get(item.variantId);
        const offer = line?.offer ?? null;
        // Con 3x2 / 2.ª al 50 % se muestra el precio por unidad ANTES de esa promo
        // (el promedio de la línea no dice nada) y la nota de qué se bonificó.
        const unit = offer ? offer.baseUnitPrice : (line?.unitPrice ?? item.unitPrice);
        const onSale = line ? unit < line.listPrice : false;
        return (
          <li key={item.variantId} className="flex gap-3 py-4 sm:gap-4">
            <StoreLink
              href={`/producto/${item.slug}`}
              onClick={onNavigate}
              className={cn("relative shrink-0 overflow-hidden rounded-sm bg-surface", thumb)}
              tabIndex={-1}
              aria-hidden
            >
              {item.image ? <Image src={item.image} alt="" fill sizes={size === "sm" ? "64px" : "96px"} className="object-contain p-1" /> : null}
            </StoreLink>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <StoreLink href={`/producto/${item.slug}`} onClick={onNavigate} className="link-quiet line-clamp-2 text-sm font-medium">
                    {item.name}
                  </StoreLink>
                  {item.variantTitle ? <p className="text-xs text-fg-muted">{item.variantTitle}</p> : null}
                  <p className="tnum mt-0.5 text-xs">
                    <span className={onSale ? "text-accent" : "text-fg-muted"}>{formatMoney(unit)}</span>
                    {onSale && line ? <s className="ml-1.5 text-fg-muted">{formatMoney(line.listPrice)}</s> : null}
                    <span className="text-fg-muted"> c/u</span>
                  </p>
                  {offer ? (
                    <p className={cn("mt-0.5 text-xs", offer.units > 0 ? "text-accent" : "text-fg-muted")}>
                      {offer.units > 0 ? `${offer.label}: ${offer.note}` : offer.note}
                    </p>
                  ) : null}
                </div>
                <p className="tnum shrink-0 text-sm font-semibold">{formatMoney(line?.lineTotal ?? unit * item.qty)}</p>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <QtyStepper value={item.qty} max={item.maxQty} label={item.name} onChange={(q) => onQty(item.variantId, q)} />
                <button type="button" onClick={() => onRemove(item.variantId)} className="min-h-8 text-xs text-fg-muted underline underline-offset-2 hover:text-fg">
                  Quitar
                </button>
              </div>
              {item.maxQty != null && item.qty >= item.maxQty ? (
                <p className="text-xs text-fg-muted">
                  {item.maxQty === 1 ? "Queda 1" : `Quedan ${item.maxQty}`}: no podés sumar más.
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Filas de descuento del resumen (drawer, carrito): "Promociones" (por unidad)
 * y una por cada promo por cantidad ("Promo 3x2 −$ X").
 */
export function PromoSummaryRows({ totals }: { totals: Pick<CartTotals, "promoTotal" | "offers"> }) {
  const offersTotal = totals.offers.reduce((acc, o) => acc + o.amount, 0);
  const unitPromos = Math.max(Math.round((totals.promoTotal - offersTotal) * 100) / 100, 0);
  return (
    <>
      {unitPromos > 0 ? (
        <div className="flex justify-between">
          <dt className="text-fg-muted">Promociones</dt>
          <dd className="text-accent">−{formatMoney(unitPromos)}</dd>
        </div>
      ) : null}
      {totals.offers.map((o) => (
        <div key={o.id} className="flex justify-between gap-3">
          <dt className="text-fg-muted">{o.label}</dt>
          <dd className="text-accent">−{formatMoney(o.amount)}</dd>
        </div>
      ))}
    </>
  );
}
