import type { Metadata } from "next";

import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { fetchPaymentMethodsFresh } from "@/lib/store/payment-methods";
import { fetchActivePromotionsFresh } from "@/lib/store/promotions";
import { fetchPickupLocationsFresh } from "@/lib/store/shipping";
import { findPolicy } from "@/lib/store/policies";

import { CheckoutFlow } from "./CheckoutFlow";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

/** Checkout en una página con pasos verticales (spec §7, DESIGN.md §6.10). */
export default async function CheckoutPage({ params }: PageProps<"/s/[store]/checkout">) {
  const { store } = await requireStore(params);
  // Medios de pago, promos y puntos de retiro SIN cache: el total que se muestra tiene que ser el que se cobra.
  const [display, paymentMethods, promotions, pickups] = await Promise.all([
    getStoreDisplay(store.id),
    fetchPaymentMethodsFresh(store.id),
    fetchActivePromotionsFresh(store.id),
    fetchPickupLocationsFresh(store.id),
  ]);
  const { settings, zones } = display;
  const terms = settings.policies.terms_md ? `/politicas/${findPolicy("terms")!.slug}` : null;

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <h1 className="h-page">Finalizá tu compra</h1>
      <CheckoutFlow
        storeName={settings.name}
        promotions={promotions}
        paymentMethods={paymentMethods.map((m) => ({
          code: m.code,
          name: m.name,
          type: m.type,
          discountPercent: m.discountPercent,
          instructions: m.instructionsMd ?? "",
        }))}
        pickups={pickups.map((p) => ({ id: p.id, name: p.name, address: p.address ?? "", hours: p.hoursText ?? "" }))}
        hasZones={zones.length > 0}
        requirePhone={settings.checkout.require_phone}
        notesEnabled={settings.checkout.order_notes_enabled}
        minOrderTotal={settings.checkout.min_order_total}
        freeShippingThreshold={display.freeShippingThreshold}
        freeShippingPartial={display.freeShippingPartial}
        whatsappPhone={settings.whatsapp_phone ?? ""}
        termsHref={terms}
        currency={settings.currency}
        net={settings.tax.show_net_price ? { defaultVat: settings.tax.default_vat_percent, label: settings.tax.label } : null}
      />
    </div>
  );
}
