import type { Metadata } from "next";
import Link from "next/link";

import { CustomerDrawer } from "@/components/admin/customers/CustomerDrawer";
import { CustomersToolbar } from "@/components/admin/customers/CustomersToolbar";
import { RelativeTime } from "@/components/admin/orders/OrderBadges";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { requireAdmin } from "@/lib/auth";
import { CUSTOMERS_PER_PAGE, listCustomers, parseCustomerFilters } from "@/lib/admin/customers";
import { getStoreInfo } from "@/lib/admin/orders";
import { formatMoney, formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  const { supabase } = await requireAdmin();
  const filters = parseCustomerFilters(await searchParams);
  const [{ rows, total }, store] = await Promise.all([listCustomers(supabase, filters), getStoreInfo(supabase)]);
  const filtered = Boolean(filters.q || filters.tag);

  return (
    <>
      <PageHeader
        title="Clientes"
        description={
          total
            ? `${formatNumber(total)} ${total === 1 ? "cliente" : "clientes"}${filters.tag ? ` con la etiqueta «${filters.tag}»` : ""}`
            : "Quién te compra, cuánto y cuándo."
        }
        actions={<CustomerDrawer />}
      />
      <CustomersToolbar />
      <Table>
        <THead>
          <tr>
            <TH>Cliente</TH>
            <TH>Teléfono</TH>
            <TH numeric>Pedidos</TH>
            <TH numeric>Total pagado</TH>
            <TH>Último pedido</TH>
            <TH>Etiquetas</TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            filtered ? (
              <TableEmpty
                colSpan={6}
                title="No hay clientes con esta búsqueda."
                action={<ButtonLink href="/admin/clientes">Limpiar filtros</ButtonLink>}
              />
            ) : (
              <TableEmpty
                colSpan={6}
                title="Todavía no hay clientes"
                description="Se crean solos con cada pedido de la tienda. También podés cargarlos a mano o al crear un pedido manual."
                action={
                  <ButtonLink href="/admin/pedidos/nuevo" variant="primary">
                    Crear pedido manual
                  </ButtonLink>
                }
              />
            )
          ) : (
            rows.map((c) => (
              <TR key={c.id}>
                <TD className="max-w-72">
                  <Link href={`/admin/clientes/${c.id}`} className="block truncate font-medium hover:underline">
                    {c.name || c.email || "Sin nombre"}
                  </Link>
                  <div className="truncate text-xs text-adm-fg-muted">{c.email ?? "Sin email"}</div>
                </TD>
                <TD muted className="tnum whitespace-nowrap">
                  {c.phone ?? "—"}
                </TD>
                <TD numeric>{formatNumber(c.orders_count)}</TD>
                <TD numeric>{formatMoney(Number(c.total_spent), { currency: store.currency })}</TD>
                <TD muted className="whitespace-nowrap">
                  {c.lastOrderAt ? <RelativeTime value={c.lastOrderAt} timeZone={store.timezone} /> : "—"}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Link
                        key={t}
                        href={`/admin/clientes?tag=${encodeURIComponent(t)}`}
                        className="rounded-[4px] bg-adm-surface-2 px-1.5 text-xs leading-5 text-adm-fg-muted hover:text-adm-fg"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {total > CUSTOMERS_PER_PAGE || filters.page > 1 ? (
        <Pagination page={filters.page} perPage={CUSTOMERS_PER_PAGE} total={total} />
      ) : null}
    </>
  );
}
