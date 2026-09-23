import type { Metadata } from "next";

import { WithdrawalsTable } from "@/components/admin/orders/WithdrawalsTable";
import { TableEmpty } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";
import { requireAdmin } from "@/lib/auth";
import { countNewWithdrawals, getStoreInfo, listWithdrawals, type WithdrawalStatus } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Arrepentimientos" };

const FILTERS: { value: WithdrawalStatus | "todas"; label: string }[] = [
  { value: "new", label: "Nuevas" },
  { value: "processed", label: "Procesadas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "todas", label: "Todas" },
];

export default async function WithdrawalsPage({ searchParams }: PageProps<"/admin/pedidos/arrepentimientos">) {
  const { supabase, store: active } = await requireAdmin();
  const sp = await searchParams;
  const raw = typeof sp.estado === "string" ? sp.estado : "new";
  const current = FILTERS.find((f) => f.value === raw)?.value ?? "new";

  const [rows, newCount, store] = await Promise.all([
    listWithdrawals(supabase, active.id, current === "todas" ? null : current),
    countNewWithdrawals(supabase, active.id),
    getStoreInfo(supabase, active.id),
  ]);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Pedidos", href: "/admin/pedidos" }, { label: "Arrepentimientos" }]}
        title="Arrepentimientos"
        description="Solicitudes del botón de arrepentimiento de la tienda. La ley da 10 días corridos desde la entrega y pide responder por el mismo medio dentro de las 24 h."
      >
        <TabsNav
          label="Estado"
          items={FILTERS.map((f) => ({
            href: f.value === "new" ? "/admin/pedidos/arrepentimientos" : `/admin/pedidos/arrepentimientos?estado=${f.value}`,
            label: f.label,
            active: f.value === current,
            count: f.value === "new" ? newCount : undefined,
          }))}
        />
      </PageHeader>
      <WithdrawalsTable
        rows={rows}
        timeZone={store.timezone}
        empty={
          <TableEmpty
            colSpan={7}
            title={current === "new" ? "No hay solicitudes nuevas" : "No hay solicitudes"}
            description="Cuando un cliente use el botón de arrepentimiento de la tienda, la solicitud aparece acá con su código."
          />
        }
      />
    </>
  );
}
