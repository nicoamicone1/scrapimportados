"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { CartLines } from "@/components/store/CartLines";
import { CouponForm } from "@/components/store/CouponForm";
import { FreeShippingBar } from "@/components/store/FreeShippingBar";
import { useCartSync } from "@/components/store/useCartSync";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { computeCart, type Promotion } from "@/lib/pricing";
import { netMerchandiseTotal, toPricingItems } from "@/lib/store/cart-pricing";

export function CartView({
  promotions,
  freeShippingThreshold,
  freeShippingPartial,
  minOrderTotal,
  transferPercent,
  transferLabel,
  net,
  empty,
}: {
  /** Precio sin impuestos nacionales (null = no se muestra). */
  net: { defaultVat: number; label: string } | null;
  promotions: Promotion[];
  freeShippingThreshold: number | null;
  freeShippingPartial: boolean;
  minOrderTotal: number;
  transferPercent: number;
  transferLabel: string;
  /** Contenido del estado vacío (destacados, render del server). */
  empty: ReactNode;
}) {
  const { items, hydrated, setQty, remove, coupon } = useCart();
  const { messages } = useCartSync();

  if (!hydrated) return <div className="mt-6 h-40 rounded-lg bg-surface" aria-hidden />;

  if (!items.length) {
    return (
      <div className="mt-4">
        {messages.length ? <Notices messages={messages} /> : null}
        <p className="text-fg-muted">Tu carrito está vacío.</p>
        <Link href="/productos" className="btn btn-primary mt-4">
          Ver todos los productos
        </Link>
        {empty}
      </div>
    );
  }

  const totals = computeCart({ items: toPricingItems(items), promotions, coupon });
  const belowMin = minOrderTotal > 0 && totals.merchandiseTotal < minOrderTotal;
  const withTransfer = transferPercent > 0 ? Math.round(totals.merchandiseTotal * (1 - transferPercent / 100)) : null;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7 xl:col-span-8">
        {messages.length ? <Notices messages={messages} /> : null}
        <div className="border-y border-border">
          <CartLines items={items} lines={totals.lines} onQty={setQty} onRemove={remove} size="md" />
        </div>
        <Link href="/productos" className="link mt-4 inline-block text-sm">
          Seguir comprando
        </Link>
      </div>

      <aside className="h-fit space-y-5 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:col-span-5 xl:col-span-4" aria-label="Resumen">
        <FreeShippingBar threshold={freeShippingThreshold} amount={totals.merchandiseTotal} partial={freeShippingPartial} />
        <CouponForm />
        {totals.coupon && !totals.coupon.applied ? <p className="text-sm text-danger">{totals.coupon.reason}</p> : null}
        <dl className="tnum space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-muted">Subtotal</dt>
            <dd>{formatMoney(totals.subtotal)}</dd>
          </div>
          {totals.promoTotal > 0 ? (
            <div className="flex justify-between">
              <dt className="text-fg-muted">Promociones</dt>
              <dd className="text-accent">−{formatMoney(totals.promoTotal)}</dd>
            </div>
          ) : null}
          {totals.coupon?.applied ? (
            <div className="flex justify-between">
              <dt className="text-fg-muted">Cupón {totals.coupon.code}</dt>
              <dd className="text-accent">{totals.coupon.freeShipping ? "Envío gratis" : `−${formatMoney(totals.couponDiscount)}`}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-fg-muted">Envío</dt>
            <dd className="text-fg-muted">Se calcula en el checkout</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(totals.merchandiseTotal)}</dd>
          </div>
{net && totals.merchandiseTotal > 0 ? (
            <div className="tnum text-xs text-fg-muted">
              {net.label}: {formatMoney(netMerchandiseTotal(totals.lines, items, net.defaultVat, totals.merchandiseTotal))}
            </div>
          ) : null}
          {withTransfer ? (
            <div className="text-right text-xs text-fg-muted">
              {formatMoney(withTransfer)} pagando con {transferLabel} ({transferPercent}&nbsp;% off)
            </div>
          ) : null}
        </dl>
        {belowMin ? (
          <p className="text-sm text-danger" role="status">
            El pedido mínimo es de {formatMoney(minOrderTotal)}. Te faltan {formatMoney(minOrderTotal - totals.merchandiseTotal)} para iniciar la compra.
          </p>
        ) : null}
        {belowMin ? (
          <span className="btn btn-solid btn-block" aria-disabled="true">
            Iniciar compra
          </span>
        ) : (
          <Link href="/checkout" className="btn btn-solid btn-block">
            Iniciar compra
          </Link>
        )}
      </aside>
    </div>
  );
}

export function Notices({ messages }: { messages: string[] }) {
  return (
    <div className="mb-4 rounded-md border border-border-strong bg-bg p-3 text-sm" role="status">
      <p className="font-medium">Actualizamos tu carrito</p>
      <ul className="mt-1 space-y-0.5 text-fg-muted">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
