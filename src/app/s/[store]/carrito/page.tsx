import type { Metadata } from "next";

import { ProductCard } from "@/components/store/ProductCard";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { isSessionToken } from "@/lib/store/checkout-sessions";
import { listProducts } from "@/lib/store/products";

import { CartRecovery, CartUnsubscribe } from "./CartRecovery";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default async function CartPage({ params, searchParams }: PageProps<"/s/[store]/carrito">) {
  const { store } = await requireStore(params);
  // Links del mail de carrito abandonado (0020): reponer el carrito o darse de baja.
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  const recoverToken = isSessionToken(pick(sp.recuperar)) ? pick(sp.recuperar) : null;
  const unsubscribeToken = isSessionToken(pick(sp.baja)) ? pick(sp.baja) : null;
  const display = await getStoreDisplay(store.id);
  const { card, settings } = display;
  const featured = (await listProducts(store.id, { featured: true, perPage: 4, outOfStock: "hide" })).items;
  const picks = featured.length
    ? featured
    : (await listProducts(store.id, { sort: "nuevos", perPage: 4, outOfStock: "hide" })).items;

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <h1 className="h-page">Tu carrito</h1>
      {unsubscribeToken ? <CartUnsubscribe token={unsubscribeToken} storeName={settings.name} /> : null}
      {recoverToken && !unsubscribeToken ? <CartRecovery token={recoverToken} /> : null}
      <CartView
        promotions={display.promotions}
        freeShippingThreshold={display.freeShippingThreshold}
        freeShippingPartial={display.freeShippingPartial}
        minOrderTotal={settings.checkout.min_order_total}
        transferPercent={card.transferPercent}
        transferLabel={card.transferLabel}
        net={settings.tax.show_net_price ? { defaultVat: settings.tax.default_vat_percent, label: settings.tax.label } : null}
        empty={
          picks.length ? (
            <section className="mt-[var(--space-section-sm)]" aria-labelledby="cart-picks">
              <h2 id="cart-picks" className="h-section mb-4">
                {featured.length ? "Destacados" : "Lo más nuevo"}
              </h2>
              <div className="store-grid" style={{ "--cols": 4 } as React.CSSProperties}>
                {picks.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    promotions={card.promotions}
                    cards={card.cards}
                    transferPercent={card.transferPercent}
                    transferLabel={card.transferLabel}
                    net={card.net}
                    whatsappPhone={card.whatsappPhone}
                    store={store}
                  />
                ))}
              </div>
            </section>
          ) : null
        }
      />
    </div>
  );
}
