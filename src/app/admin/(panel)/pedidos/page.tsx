import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { ExpireSweep } from "@/components/admin/orders/ExpireSweep";
import { OrdersFilters } from "@/components/admin/orders/OrdersFilters";
import { OrdersTable } from "@/components/admin/orders/OrdersTable";
import { WithdrawalsLink } from "@/components/admin/orders/WithdrawalsLink";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { TableEmpty } from "@/components/ui/Table";
import { TabsNav } from "@/components/ui/Tabs";
import { requireAdmin } from "@/lib/auth";
import {
  countNewWithdrawals,
  getOrderTabCounts,
  getStoreInfo,
  hasActiveFilters,
  listOrders,
  listPaymentMethods,
  ORDER_TAB_LABELS,
  ORDER_TABS,
  ORDERS_PER_PAGE,
  parseOrderFilters,
  sweepExpiredOrders,
} from "@/lib/admin/orders";
import { formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Pedidos" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const filters = parseOrderFilters(sp);

  // Barrido perezoso de reservas vencidas antes de leer (P0-06).
  const [expired, store] = await Promise.all([sweepExpiredOrders(supabase), getStoreInfo(supabase)]);

  const [methods, counts, { rows, total }, withdrawalsNew] = await Promise.all([
    listPaymentMethods(supabase),
    getOrderTabCounts(supabase),
    listOrders(supabase, filters, store.timezone),
    countNewWithdrawals(supabase),
  ]);

  const tabHref = (tab: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v && k !== "tab" && k !== "page") p.set(k, v);
    }
    if (tab !== "todos") p.set("tab", tab);
    const qs = p.toString();
    return qs ? `/admin/pedidos?${qs}` : "/admin/pedidos";
  };

  const methodNames = Object.fromEntries(methods.map((m) => [m.code, m.name]));
  const filtered = hasActiveFilters(filters) || filters.tab !== "todos";

  return (
    <>
      <ExpireSweep expired={expired} />
      <PageHeader
        title="Pedidos"
        description={
          counts.todos
            ? `${formatNumber(counts.pendientes)} pendientes · ${formatNumber(counts.preparar)} por preparar · ${formatNumber(counts.todos)} en total`
            : "Todavía no entró ningún pedido."
        }
        actions={
          <>
            <WithdrawalsLink count={withdrawalsNew} />
            <ButtonLink href="/admin/pedidos/nuevo" variant="primary" icon={<Plus />}>
              Crear pedido
            </ButtonLink>
          </>
        }
      >
        <TabsNav
          label="Vistas rápidas"
          items={ORDER_TABS.map((tab) => ({
            href: tabHref(tab),
            label: ORDER_TAB_LABELS[tab],
            active: filters.tab === tab,
            count: counts[tab],
          }))}
        />
      </PageHeader>

      <OrdersTable
        rows={rows}
        methodNames={methodNames}
        timeZone={store.timezone}
        filters={<OrdersFilters methods={methods.map((m) => ({ code: m.code, name: m.name }))} />}
        empty={
          filtered ? (
            <TableEmpty
              colSpan={10}
              title="No hay pedidos con estos filtros."
              description="Probá con otra búsqueda o sacá algún filtro."
              action={<ButtonLink href="/admin/pedidos">Limpiar filtros</ButtonLink>}
            />
          ) : (
            <TableEmpty
              colSpan={10}
              title="Todavía no hay pedidos"
              description="Cuando alguien compre en tu tienda lo vas a ver acá. También podés cargar uno a mano, por ejemplo una venta por WhatsApp o en el local."
              action={
                <>
                  <ButtonLink href="/admin/pedidos/nuevo" variant="primary">
                    Crear pedido manual
                  </ButtonLink>
                  <ButtonLink href="/" external>
                    Ver la tienda
                  </ButtonLink>
                </>
              }
            />
          )
        }
      />
      {total > ORDERS_PER_PAGE || filters.page > 1 ? (
        <Pagination page={filters.page} perPage={ORDERS_PER_PAGE} total={total} />
      ) : total ? (
        <p className="tnum py-3 text-[13px] text-adm-fg-muted">
          {formatNumber(total)} {total === 1 ? "pedido" : "pedidos"}
        </p>
      ) : null}
    </>
  );
}
