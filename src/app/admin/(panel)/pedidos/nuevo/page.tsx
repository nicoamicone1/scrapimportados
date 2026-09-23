import type { Metadata } from "next";

import { ManualOrderForm } from "@/components/admin/orders/ManualOrderForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { getStoreInfo, listPaymentMethods } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Crear pedido" };

export default async function NewOrderPage() {
  const { supabase, store: currentStore } = await requireAdmin();
  const [store, methods, pickups, zones] = await Promise.all([
    getStoreInfo(supabase, currentStore.id),
    listPaymentMethods(supabase, currentStore.id),
    supabase
      .from("pickup_locations")
      .select("id, name, address")
      .eq("store_id", currentStore.id)
      .eq("is_active", true)
      .order("position"),
    supabase
      .from("shipping_zones")
      .select("id, name, cost")
      .eq("store_id", currentStore.id)
      .eq("is_active", true)
      .order("position"),
  ]);
  const active = methods.filter((m) => m.isActive);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Pedidos", href: "/admin/pedidos" }, { label: "Crear pedido" }]}
        title="Crear pedido"
        description="Para ventas por WhatsApp, teléfono o en el local. Descuenta stock igual que un pedido de la tienda."
      />
      {active.length ? (
        <ManualOrderForm
          currency={store.currency}
          methods={active.map((m) => ({ code: m.code, name: m.name, discountPercent: m.discountPercent }))}
          pickups={pickups.data ?? []}
          zones={(zones.data ?? []).map((z) => ({ id: z.id, name: z.name, cost: Number(z.cost) }))}
          reservationHours={store.reservationHours}
          inventoryPolicy={store.inventoryPolicy}
        />
      ) : (
        <EmptyState
          title="No hay métodos de pago activos"
          description="Activá al menos un método de pago para poder registrar pedidos."
          actions={
            <ButtonLink href="/admin/configuracion" variant="primary">
              Ir a Configuración
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
