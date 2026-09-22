import type { Metadata } from "next";

import { PaymentsForm } from "@/components/admin/settings/PaymentsForm";
import { getAdminSettings, listPaymentMethodsAdmin } from "@/lib/admin/settings";
import type { PaymentsSettingsInput } from "@/lib/schemas/settings";
import { DEFAULT_ORDER_TEMPLATE } from "@/lib/store/whatsapp";

export const metadata: Metadata = { title: "Pagos y checkout · Configuración" };

export default async function PagosSettingsPage() {
  const [s, methods] = await Promise.all([getAdminSettings(), listPaymentMethodsAdmin()]);
  const t = s.checkout.transfer;
  const initial: PaymentsSettingsInput = {
    methods: methods.map((m) => ({
      id: m.id,
      code: m.code,
      type: m.type,
      name: m.name,
      is_active: m.is_active,
      discount_percent: String(m.discount_percent),
      instructions_md: m.instructions_md,
    })),
    transfer: {
      bank_name: t.bank_name,
      holder: t.holder,
      cbu: t.cbu,
      alias: t.alias,
      cuit: t.cuit,
      instructions_md: t.instructions_md,
    },
    whatsapp_template: s.checkout.whatsapp.message_template || DEFAULT_ORDER_TEMPLATE,
    require_phone: s.checkout.require_phone,
    order_notes_enabled: s.checkout.order_notes_enabled,
    min_order_total: String(s.checkout.min_order_total),
    reservation_hours: String(s.checkout.reservation_hours),
    inventory_policy: s.inventory_policy === "on_paid" ? "on_paid" : "on_order",
    low_stock_threshold: String(s.low_stock_threshold),
    out_of_stock_display: s.catalog.out_of_stock_display,
    free_shipping_bar: {
      enabled: s.free_shipping_bar.enabled,
      threshold: s.free_shipping_bar.threshold === null ? "" : String(s.free_shipping_bar.threshold),
    },
    whatsapp_button: { ...s.whatsapp_button },
  };

  return (
    <PaymentsForm
      initial={initial}
      store={{ name: s.name, whatsappPhone: s.whatsapp_phone ?? "", currency: s.currency, locale: s.locale }}
    />
  );
}
