import { MessageCircle } from "lucide-react";
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
import { waLink } from "@/lib/admin/whatsapp";
import { formatMoney, formatNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Clientes" };

/** Iniciales para el avatar (los clientes con más de un pedido, en pomelo: vuelven a comprar). */
function initials(name: string) {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[1][0] ?? "") : "")).toUpperCase() || "?";
}

export default async function CustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  const { supabase, store: active } = await requireAdmin();
  const filters = parseCustomerFilters(await searchParams);
  const [{ rows, total }, store] = await Promise.all([listCustomers(supabase, active.id, filters), getStoreInfo(supabase, active.id)]);
  const filtered = Boolean(filters.q || filters.tag);
  // Saludo listo para abrir el chat desde la fila (sin teléfono válido no hay botón).
  const waByCustomer = new Map(
    rows.map((c) => {
      const first = (c.name ?? "").trim().split(/\s+/)[0];
      return [c.id, waLink(c.phone, `${first ? `Hola ${first}` : "Hola"}, te escribimos de ${store.name}.`)] as const;
    }),
  );

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
            <TH numeric>Pedidos</TH>
            <TH numeric>Total pagado</TH>
            <TH className="hidden md:table-cell">Último pedido</TH>
            <TH className="hidden lg:table-cell">Etiquetas</TH>
            <TH className="w-10">
              <span className="sr-only">Escribirle por WhatsApp</span>
            </TH>
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
                <TD className="max-w-80">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        c.orders_count > 1 ? "bg-adm-accent-2-soft text-adm-accent-2-ink" : "bg-adm-surface-2 text-adm-fg-muted"
                      }`}
                    >
                      {initials(c.name || c.email || "?")}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/admin/clientes/${c.id}`} className="block truncate font-medium text-adm-fg hover:text-adm-link hover:underline">
                        {c.name || c.email || "Sin nombre"}
                      </Link>
                      <div className="tnum truncate text-xs text-adm-fg-muted">{[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}</div>
                    </div>
                  </div>
                </TD>
                <TD numeric>{formatNumber(c.orders_count)}</TD>
                <TD numeric className="font-semibold text-adm-fg">
                  {formatMoney(Number(c.total_spent), { currency: store.currency })}
                </TD>
                <TD muted className="hidden whitespace-nowrap md:table-cell">
                  {c.lastOrderAt ? <RelativeTime value={c.lastOrderAt} timeZone={store.timezone} /> : "—"}
                </TD>
                <TD className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Link
                        key={t}
                        href={`/admin/clientes?tag=${encodeURIComponent(t)}`}
                        className="inline-flex h-6 items-center rounded-full bg-adm-surface-2 px-2.5 text-xs text-adm-fg-muted transition-colors duration-[140ms] ease-eco-out hover:bg-adm-border hover:text-adm-fg"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                </TD>
                <TD className="w-10 pl-0 text-right">
                  {waByCustomer.get(c.id) ? (
                    <ButtonLink
                      href={waByCustomer.get(c.id) ?? "#"}
                      external
                      variant="ghost"
                      size="icon-sm"
                      className="max-sm:size-11"
                      aria-label={`Escribirle a ${c.name || "este cliente"} por WhatsApp`}
                    >
                      <MessageCircle />
                    </ButtonLink>
                  ) : null}
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
