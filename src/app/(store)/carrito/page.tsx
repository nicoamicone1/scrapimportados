import type { Metadata } from "next";

import { ProductCard } from "@/components/store/ProductCard";
import { getStoreDisplay } from "@/lib/store/display";
import { listProducts } from "@/lib/store/products";

import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Carrito", robots: { index: false, follow: false } };

export default async function CartPage() {
  const display = await getStoreDisplay();
  const { card, settings } = display;
  const featured = (await listProducts({ featured: true, perPage: 4, outOfStock: "hide" })).items;
  const picks = featured.length ? featured : (await listProducts({ sort: "nuevos", perPage: 4, outOfStock: "hide" })).items;

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <h1 className="h-page">Tu carrito</h1>
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
