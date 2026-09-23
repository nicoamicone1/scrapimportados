"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { StoreLink } from "@/components/store/StoreLink";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { computeCart, type Promotion } from "@/lib/pricing";
import { netMerchandiseTotal, toPricingItems } from "@/lib/store/cart-pricing";

import { CartLines, PromoSummaryRows } from "./CartLines";
import { Drawer } from "./Drawer";
import { FreeShippingBar } from "./FreeShippingBar";

export interface CartDrawerProps {
  promotions: Promotion[];
  freeShippingThreshold: number | null;
  freeShippingPartial: boolean;
  minOrderTotal: number;
  net?: { defaultVat: number; label: string } | null;
}

/** Mini-carrito (DESIGN.md §6.10): 420px desde la derecha, pie con totales y "Iniciar compra". */
export function CartDrawer({ promotions, freeShippingThreshold, freeShippingPartial, minOrderTotal, net }: CartDrawerProps) {
  const { items, isOpen, close, setQty, remove, coupon, count } = useCart();
  const pathname = usePathname();

  // Navegar cierra el drawer.
  useEffect(() => {
    close();
  }, [pathname, close]);

  const totals = computeCart({ items: toPricingItems(items), promotions, coupon });
  const belowMin = minOrderTotal > 0 && totals.merchandiseTotal < minOrderTotal;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title={count ? `Tu carrito (${count})` : "Tu carrito"}
      footer={
        items.length ? (
          <div className="space-y-3">
            <FreeShippingBar threshold={freeShippingThreshold} amount={totals.merchandiseTotal} partial={freeShippingPartial} />
            <dl className="tnum space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Subtotal</dt>
                <dd>{formatMoney(totals.subtotal)}</dd>
              </div>
              <PromoSummaryRows totals={totals} />
              {totals.couponDiscount > 0 && totals.coupon?.applied ? (
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Cupón {totals.coupon.code}</dt>
                  <dd className="text-accent">−{formatMoney(totals.couponDiscount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(totals.merchandiseTotal)}</dd>
              </div>
            </dl>
            {net && totals.merchandiseTotal > 0 ? (
            <p className="tnum text-xs text-fg-muted">
              {net.label}: {formatMoney(netMerchandiseTotal(totals.lines, items, net.defaultVat, totals.merchandiseTotal))}
            </p>
          ) : null}
            <p className="text-xs text-fg-muted">El envío y el descuento por medio de pago se calculan en el checkout.</p>
            {belowMin ? (
              <p className="text-sm text-danger" role="status">
                El pedido mínimo es de {formatMoney(minOrderTotal)}. Te faltan {formatMoney(minOrderTotal - totals.merchandiseTotal)}.
              </p>
            ) : null}
            {belowMin ? (
              <span className="btn btn-solid btn-block" aria-disabled="true">
                Iniciar compra
              </span>
            ) : (
              <StoreLink href="/checkout" className="btn btn-solid btn-block" onClick={close}>
                Iniciar compra
              </StoreLink>
            )}
            <div className="flex items-center justify-between text-sm">
              <StoreLink href="/carrito" className="link" onClick={close}>
                Ver carrito
              </StoreLink>
              <button type="button" className="link" onClick={close}>
                Seguir comprando
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {items.length ? (
        <div className="px-4 sm:px-5">
          <CartLines items={items} lines={totals.lines} onQty={setQty} onRemove={remove} onNavigate={close} />
        </div>
      ) : (
        <div className="px-4 py-8 sm:px-5">
          <p className="text-base">Tu carrito está vacío.</p>
          <p className="mt-1 text-sm text-fg-muted">Agregá productos y los vas a ver acá.</p>
          <StoreLink href="/productos" className="btn btn-primary mt-6" onClick={close}>
            Ver todos los productos
          </StoreLink>
        </div>
      )}
    </Drawer>
  );
}
