import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RefreshOrdersBadge } from "@/components/admin/OrdersBadge";
import { AutosaveNotes } from "@/components/admin/orders/AutosaveNotes";
import { CopyButton } from "@/components/admin/orders/CopyButton";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/OrderBadges";
import { OrderHeaderActions } from "@/components/admin/orders/OrderHeaderActions";
import { OrderTimeline } from "@/components/admin/orders/OrderTimeline";
import { PaymentsCard } from "@/components/admin/orders/PaymentsCard";
import { ReservationControl } from "@/components/admin/orders/ReservationControl";
import { WhatsAppComposer } from "@/components/admin/orders/WhatsAppComposer";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import {
  addressLines,
  amountPaid,
  balanceDue,
  cancelReasonLabel,
  hasReservation,
  isOrderStatus,
  otherDiscount,
  parseAddress,
} from "@/lib/admin/order-utils";
import {
  getOrderDetail,
  getStoreInfo,
  listPaymentMethods,
  markOrderSeen,
  orderPublicPath,
  orderPublicUrl,
  paymentMethodName,
} from "@/lib/admin/orders";
import { whatsAppTemplateFor } from "@/lib/admin/whatsapp";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatNumber, formatPercent } from "@/lib/money";
import { BUNDLE_DISCOUNT_LABEL, splitPromotions } from "@/lib/store/order-bundle";
import { storeHref } from "@/lib/tenant/urls";

import { saveInternalNotesFor } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/admin/pedidos/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Pedido" };
  const { supabase, store } = await requireAdmin();
  const { data } = await supabase.from("orders").select("number").eq("id", id).eq("store_id", store.id).maybeSingle();
  return { title: data ? `Pedido #${data.number}` : "Pedido" };
}

export default async function OrderDetailPage({ params }: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, store: active } = await requireAdmin();

  const [detail, store, methods] = await Promise.all([
    getOrderDetail(supabase, active.id, id),
    getStoreInfo(supabase, active.id),
    listPaymentMethods(supabase, active.id),
  ]);
  if (!detail) notFound();
  const { order, customer, items, events, payments, pickup, customerRecord } = detail;
  const seenNow = await markOrderSeen(supabase, active.id, order);

  const tz = store.timezone;
  const money = (v: number) => formatMoney(v, { currency: order.currency });
  const status = isOrderStatus(order.status) ? order.status : "pending";
  const paid = amountPaid(payments);
  const balance = order.status === "cancelled" ? 0 : balanceDue(Number(order.total), paid);
  const address = parseAddress(order.shipping_address);
  // URL absoluta de la tienda (WhatsApp / copiar) y href de navegación desde el panel.
  const publicUrl = orderPublicUrl(active, order.public_token);
  const publicHref = storeHref(active, orderPublicPath(order.public_token));
  const extra = otherDiscount({
    subtotal: Number(order.subtotal),
    promo_total: Number(order.promo_total),
    coupon_discount: Number(order.coupon_discount),
    payment_discount: Number(order.payment_discount),
    discount_total: Number(order.discount_total),
    shipping_cost: Number(order.shipping_cost),
    total: Number(order.total),
  });
  // `promo_total` incluye las promos por cantidad; desde 0018 vienen aparte en `bundle_discount`.
  const promos = splitPromotions(Number(order.promo_total), order.bundle_discount);
  const itemsCount = items.reduce((s, i) => s + i.qty, 0);
  const phone = customer.phone ?? customerRecord?.phone ?? null;

  return (
    <>
      {seenNow ? <RefreshOrdersBadge /> : null}
      <PageHeader
        breadcrumb={[{ label: "Pedidos", href: "/admin/pedidos" }, { label: `#${order.number}` }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tnum">Pedido #{order.number}</span>
            <OrderStatusBadge status={order.status} fulfillment={order.fulfillment} />
            <PaymentStatusBadge status={order.payment_status} />
          </span>
        }
        description={
          <>
            <time dateTime={order.created_at}>{formatDateTime(order.created_at, tz)}</time>
            {" · "}
            {order.source === "manual" ? "Cargado a mano" : order.source === "whatsapp" ? "WhatsApp" : "Tienda online"}
            {" · "}
            {formatNumber(itemsCount)} {itemsCount === 1 ? "unidad" : "unidades"}
          </>
        }
        actions={
          <OrderHeaderActions
            id={order.id}
            number={order.number}
            status={status}
            fulfillment={order.fulfillment}
            tracking={{ carrier: order.tracking_carrier, number: order.tracking_number, url: order.tracking_url }}
          />
        }
      />

      {order.status === "cancelled" ? (
        <div className="mb-4 rounded-adm border border-adm-border bg-adm-surface-2 px-4 py-3 text-[13px]">
          <span className="font-medium">Pedido cancelado</span>
          {order.cancelled_at ? ` el ${formatDateTime(order.cancelled_at, tz)}` : ""}
          {order.cancel_reason ? `. Motivo: ${cancelReasonLabel(order.cancel_reason)}.` : "."}
          {detail.stockDeducted ? " El stock que había descontado volvió al inventario." : ""}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* Ítems y totales */}
          <Card>
            <CardHeader title="Productos" description={`${items.length} ${items.length === 1 ? "línea" : "líneas"}`} />
            <div className="adm-scroll overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="sr-only">
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Cantidad</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const promo = Number(it.list_price) > Number(it.unit_price);
                    return (
                      <tr key={it.id} className="border-b border-adm-border">
                        <td className="py-2.5 pr-3 pl-4">
                          <div className="flex items-center gap-3">
                            {it.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- miniatura de URL externa/bucket, sin optimizar
                              <img
                                src={it.image_url}
                                alt=""
                                width={40}
                                height={40}
                                className="size-10 shrink-0 rounded-[4px] border border-adm-border object-cover"
                              />
                            ) : (
                              <span aria-hidden className="size-10 shrink-0 rounded-[4px] border border-adm-border bg-adm-surface-2" />
                            )}
                            <div className="min-w-0">
                              {it.product_id ? (
                                <Link href={`/admin/productos/${it.product_id}`} className="font-medium hover:underline">
                                  {it.name}
                                </Link>
                              ) : (
                                <span className="font-medium">{it.name}</span>
                              )}
                              <div className="text-xs text-adm-fg-muted">
                                {it.variant_title ? <span>{it.variant_title}</span> : null}
                                {it.variant_title && it.sku ? " · " : null}
                                {it.sku ? <span className="font-mono">{it.sku}</span> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="tnum px-3 py-2.5 text-right whitespace-nowrap">
                          {promo ? (
                            <span className="mr-1.5 text-xs text-adm-fg-muted line-through">{money(Number(it.list_price))}</span>
                          ) : null}
                          {money(Number(it.unit_price))}
                        </td>
                        <td className="tnum px-3 py-2.5 text-right whitespace-nowrap text-adm-fg-muted">× {it.qty}</td>
                        <td className="tnum py-2.5 pr-4 pl-3 text-right font-medium whitespace-nowrap">{money(Number(it.total))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="tnum ml-auto max-w-sm space-y-1.5 px-4 py-3 text-[13px]">
              <TotalRow label="Subtotal" value={money(Number(order.subtotal))} />
              {promos.unit > 0 ? <TotalRow label="Promociones" value={`− ${money(promos.unit)}`} /> : null}
              {promos.bundle > 0 ? <TotalRow label={BUNDLE_DISCOUNT_LABEL} value={`− ${money(promos.bundle)}`} /> : null}
              {Number(order.coupon_discount) > 0 ? (
                <TotalRow label={`Cupón ${order.coupon_code ?? ""}`} value={`− ${money(Number(order.coupon_discount))}`} />
              ) : null}
              {Number(order.payment_discount) > 0 ? (
                <TotalRow
                  label={`Descuento por ${paymentMethodName(methods, order.payment_method_code).toLowerCase()} (${formatPercent(Number(order.payment_discount_percent))})`}
                  value={`− ${money(Number(order.payment_discount))}`}
                />
              ) : null}
              {extra > 0 ? <TotalRow label="Descuento manual" value={`− ${money(extra)}`} /> : null}
              <TotalRow
                label={order.fulfillment === "pickup" ? "Retiro" : `Envío${order.shipping_zone_name ? ` (${order.shipping_zone_name})` : ""}`}
                value={Number(order.shipping_cost) > 0 ? money(Number(order.shipping_cost)) : "Sin cargo"}
              />
              <div className="flex justify-between border-t border-adm-border pt-2 text-sm font-semibold">
                <dt>Total</dt>
                <dd>{money(Number(order.total))}</dd>
              </div>
              <TotalRow label="Método de pago" value={paymentMethodName(methods, order.payment_method_code)} muted />
            </dl>
          </Card>

          <PaymentsCard
            orderId={order.id}
            number={order.number}
            currency={order.currency}
            total={Number(order.total)}
            paid={paid}
            balance={balance}
            paymentStatus={order.payment_status}
            defaultMethod={order.payment_method_code}
            methods={methods.map((m) => ({ code: m.code, name: m.name }))}
            payments={payments.map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              methodCode: p.method_code,
              reference: p.reference,
              receiptUrl: p.receipt_url,
              paidAt: p.paid_at,
              note: p.note,
              authorName: p.authorName,
            }))}
            cancelled={order.status === "cancelled"}
            timeZone={tz}
          />

          <OrderTimeline
            orderId={order.id}
            timeZone={tz}
            events={events.map((e) => ({
              id: e.id,
              type: e.type,
              message: e.message,
              createdAt: e.created_at,
              authorName: e.authorName,
              visibleToCustomer: e.visible_to_customer,
            }))}
          />
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Cliente" />
            <CardBody className="space-y-3 text-[13px]">
              <div>
                {customerRecord ? (
                  <Link href={`/admin/clientes/${customerRecord.id}`} className="text-sm font-medium text-adm-accent hover:underline">
                    {customer.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium">{customer.name}</span>
                )}
                {customerRecord ? (
                  <p className="tnum text-xs text-adm-fg-muted">
                    {formatNumber(customerRecord.orders_count)} {customerRecord.orders_count === 1 ? "pedido" : "pedidos"} ·{" "}
                    {money(Number(customerRecord.total_spent))} pagados
                  </p>
                ) : null}
              </div>
              <dl className="space-y-1">
                {customer.email ? (
                  <div>
                    <dt className="sr-only">Email</dt>
                    <dd>
                      <a href={`mailto:${customer.email}`} className="break-all hover:underline">
                        {customer.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {phone ? (
                  <div>
                    <dt className="sr-only">Teléfono</dt>
                    <dd className="tnum">{phone}</dd>
                  </div>
                ) : null}
                {customer.doc ? (
                  <div className="text-adm-fg-muted">
                    <dt className="inline">DNI/CUIT: </dt>
                    <dd className="tnum inline">{customer.doc}</dd>
                  </div>
                ) : null}
              </dl>
              <WhatsAppComposer
                orderId={order.id}
                phone={phone}
                defaultKind={whatsAppTemplateFor(order)}
                context={{
                  storeName: store.name,
                  customerName: customer.name,
                  number: order.number,
                  total: money(Number(order.total)),
                  balance: balance > 0 && balance !== Number(order.total) ? money(balance) : null,
                  orderUrl: publicUrl,
                  tracking: { carrier: order.tracking_carrier, number: order.tracking_number, url: order.tracking_url },
                  pickup: pickup ? { name: pickup.name, address: pickup.address, hours: pickup.hours_text } : null,
                  transfer: { alias: store.transfer.alias, cbu: store.transfer.cbu },
                  paymentMethodCode: order.payment_method_code,
                  expiresLabel:
                    hasReservation(order) && order.expires_at ? formatDateTime(order.expires_at, tz) : null,
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={order.fulfillment === "pickup" ? "Retiro en el local" : "Envío"} />
            <CardBody className="space-y-2 text-[13px]">
              {order.fulfillment === "pickup" ? (
                pickup ? (
                  <>
                    <p className="font-medium">{pickup.name}</p>
                    {pickup.address ? <p>{pickup.address}</p> : null}
                    {pickup.hours_text ? <p className="text-adm-fg-muted">{pickup.hours_text}</p> : null}
                  </>
                ) : (
                  <p className="text-adm-fg-muted">Retira en el local (sin punto de retiro elegido).</p>
                )
              ) : (
                <>
                  {address ? (
                    <address className="not-italic">
                      {addressLines(address).map((l) => (
                        <div key={l}>{l}</div>
                      ))}
                      {address.notes ? <div className="mt-1 text-adm-fg-muted">{address.notes}</div> : null}
                    </address>
                  ) : (
                    <p className="text-adm-fg-muted">Sin dirección cargada.</p>
                  )}
                  <p className="tnum text-adm-fg-muted">
                    {order.shipping_zone_name ?? "Zona sin definir"} ·{" "}
                    {Number(order.shipping_cost) > 0 ? money(Number(order.shipping_cost)) : "sin cargo"}
                  </p>
                  {order.tracking_number || order.tracking_carrier ? (
                    <div className="rounded-adm bg-adm-surface-2 px-3 py-2">
                      <p className="font-medium">{order.tracking_carrier ?? "Seguimiento"}</p>
                      {order.tracking_number ? <p className="font-mono text-xs">{order.tracking_number}</p> : null}
                      {order.tracking_url ? (
                        <a
                          href={order.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-adm-accent hover:underline"
                        >
                          Abrir seguimiento
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>

          {hasReservation(order) && order.expires_at ? (
            <Card>
              <CardHeader title="Reserva de stock" />
              <CardBody>
                <ReservationControl orderId={order.id} expiresAt={order.expires_at} timeZone={tz} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Notas" />
            <CardBody className="space-y-4">
              <div>
                <p className="text-[13px] font-medium">Del cliente</p>
                <p className="mt-1 text-[13px] whitespace-pre-line text-adm-fg-muted">{order.notes || "Sin notas."}</p>
              </div>
              <AutosaveNotes
                id="internal-notes"
                label="Internas (no las ve el cliente)"
                initial={order.internal_notes ?? ""}
                placeholder="Ej.: envolver para regalo, cobrar seña, etc."
                save={saveInternalNotesFor.bind(null, order.id)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Link del pedido" description="Lo que ve el cliente: estado, pagos y seguimiento." />
            <CardBody className="space-y-2">
              <p className="font-mono text-xs break-all text-adm-fg-muted">{publicUrl}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={publicUrl} label="Copiar link" />
                <ButtonLink href={publicHref} external size="sm" icon={<ExternalLink />}>
                  Abrir
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "flex justify-between gap-4 text-adm-fg-muted" : "flex justify-between gap-4"}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
