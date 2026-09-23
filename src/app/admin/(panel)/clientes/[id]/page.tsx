import { Mail, MessageCircle, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerDrawer } from "@/components/admin/customers/CustomerDrawer";
import { AutosaveNotes } from "@/components/admin/orders/AutosaveNotes";
import { OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "@/components/admin/orders/OrderBadges";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, Stat, StatStrip } from "@/components/ui/display";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { requireAdmin } from "@/lib/auth";
import { getCustomerDetail } from "@/lib/admin/customers";
import { addressLines, parseAddress } from "@/lib/admin/order-utils";
import { getStoreInfo } from "@/lib/admin/orders";
import { waLink } from "@/lib/admin/whatsapp";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";

import { saveCustomerNotesFor } from "../actions";

export const metadata: Metadata = { title: "Cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerPage({ params }: PageProps<"/admin/clientes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, store: currentStore } = await requireAdmin();
  const [detail, store] = await Promise.all([getCustomerDetail(supabase, currentStore.id, id), getStoreInfo(supabase, currentStore.id)]);
  if (!detail) notFound();
  const { customer: c, orders, pending } = detail;
  const money = (v: number) => formatMoney(v, { currency: store.currency });
  const address = parseAddress(c.default_address);
  const name = c.name || c.email || "Cliente";
  const firstName = name.split(" ")[0];
  const wa = waLink(c.phone, `Hola ${firstName}, te escribimos de ${store.name}.`);
  const active = orders.filter((o) => o.status !== "cancelled");
  const avg = active.length ? active.reduce((s, o) => s + o.total, 0) / active.length : 0;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Clientes", href: "/admin/clientes" }, { label: name }]}
        title={name}
        description={`Cliente desde el ${formatDate(c.created_at, store.timezone)}`}
        actions={
          <>
            {wa ? (
              <ButtonLink href={wa} external icon={<MessageCircle />}>
                WhatsApp
              </ButtonLink>
            ) : null}
            {c.email ? (
              <ButtonLink href={`mailto:${c.email}`} external icon={<Mail />}>
                Email
              </ButtonLink>
            ) : null}
            <CustomerDrawer
              mode="edit"
              initial={{
                id: c.id,
                name: c.name ?? "",
                email: c.email ?? "",
                phone: c.phone ?? "",
                docNumber: c.doc_number ?? "",
                address: address ?? { street: "", number: "", floor: "", city: "", province: "", postal_code: "", notes: "" },
                notes: c.notes ?? "",
                tags: c.tags.join(", "),
              }}
            />
          </>
        }
      />

      <StatStrip className="mb-4">
        <Stat label="Pedidos" value={formatNumber(c.orders_count)} delta="Sin contar cancelados" />
        <Stat label="Total pagado" value={money(Number(c.total_spent))} />
        <Stat label="Ticket promedio" value={money(avg)} />
        <Stat label="Por cobrar" value={money(pending)} alert={pending > 0} delta={pending > 0 ? "En pedidos sin pagar" : "Nada pendiente"} />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader
            title="Pedidos"
            actions={
              <ButtonLink href="/admin/pedidos/nuevo" size="sm" icon={<Plus />}>
                Crear pedido
              </ButtonLink>
            }
          />
          <Table containerClassName="rounded-none border-0">
            <THead>
              <tr>
                <TH>Pedido</TH>
                <TH>Fecha</TH>
                <TH numeric>Total</TH>
                <TH>Estado</TH>
                <TH>Pago</TH>
              </tr>
            </THead>
            <TBody>
              {orders.length === 0 ? (
                <TableEmpty colSpan={5} title="Sin pedidos todavía" />
              ) : (
                orders.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/admin/pedidos/${o.id}`} className="tnum font-medium hover:underline">
                        #{o.number}
                      </Link>
                    </TD>
                    <TD muted>
                      <RelativeTime value={o.createdAt} timeZone={store.timezone} />
                    </TD>
                    <TD numeric>{formatMoney(o.total, { currency: o.currency })}</TD>
                    <TD>
                      <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                    </TD>
                    <TD>
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Datos" />
            <CardBody>
              <dl className="space-y-2 text-[13px]">
                <Item label="Email" value={c.email} />
                <Item label="Teléfono" value={c.phone} />
                <Item label="DNI o CUIT" value={c.doc_number} />
                <div>
                  <dt className="text-xs text-adm-fg-muted">Dirección</dt>
                  <dd>
                    {address ? addressLines(address).map((l) => <div key={l}>{l}</div>) : <span className="text-adm-fg-muted">Sin cargar</span>}
                  </dd>
                </div>
                {c.tags.length ? (
                  <div>
                    <dt className="text-xs text-adm-fg-muted">Etiquetas</dt>
                    <dd className="mt-0.5 flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Link
                          key={t}
                          href={`/admin/clientes?tag=${encodeURIComponent(t)}`}
                          className="rounded-[4px] bg-adm-surface-2 px-1.5 text-xs leading-5 text-adm-fg-muted hover:text-adm-fg"
                        >
                          {t}
                        </Link>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <AutosaveNotes
                id="customer-notes"
                label="Notas"
                initial={c.notes ?? ""}
                placeholder="Preferencias, datos de facturación, cómo le gusta que lo contacten…"
                save={saveCustomerNotesFor.bind(null, c.id)}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-adm-fg-muted">{label}</dt>
      <dd className="break-words">{value || <span className="text-adm-fg-muted">—</span>}</dd>
    </div>
  );
}
