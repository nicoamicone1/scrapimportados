import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { PlanGate } from "@/components/admin/PlanGate";
import { PrintToolbar } from "@/components/admin/orders/PrintToolbar";
import { getAdminState } from "@/lib/auth";
import { addressLines, amountPaid, balanceDue, otherDiscount, parseAddress, PAYMENT_STATUS_LABELS, isPaymentStatus } from "@/lib/admin/order-utils";
import {
  getOrdersForPrint,
  getStoreInfo,
  listPaymentMethods,
  orderPublicUrl,
  paymentMethodName,
  type PrintableOrder,
  type StoreInfo,
} from "@/lib/admin/orders";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { hasFeature } from "@/lib/plans";

export const metadata: Metadata = { title: "Remitos" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 100;

/**
 * Remitos imprimibles (P0-05): una hoja por pedido, A4 o ticket de 80 mm
 * (`?format=80mm`), con QR a `/pedido/[token]` en la URL pública de la
 * tienda activa. `?auto=0` no abre el diálogo de impresión solo. Requiere
 * la feature de plan `orders.print`.
 */
export default async function PrintOrdersPage({ searchParams }: PageProps<"/admin/pedidos/imprimir">) {
  const sp = await searchParams;
  const rawIds = typeof sp.ids === "string" ? sp.ids : "";
  const ids = Array.from(new Set(rawIds.split(",").map((s) => s.trim()).filter((s) => UUID.test(s)))).slice(0, MAX);
  const format = sp.format === "80mm" ? "80mm" : "a4";
  const autoPrint = sp.auto !== "0";

  const state = await getAdminState();
  if (state.kind === "anonymous") redirect(`/login?next=${encodeURIComponent(`/admin/pedidos/imprimir?ids=${ids.join(",")}`)}`);
  if (state.kind === "no-stores") redirect("/app/nueva");
  if (state.kind === "inactive") redirect("/admin");
  const { supabase, store: active, plan } = state.ctx;

  if (!hasFeature(plan, "orders.print")) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <PlanGate feature="orders.print" plan={plan} description="Imprimí remitos A4 o tickets de 80 mm con el QR del pedido.">
          {null}
        </PlanGate>
      </main>
    );
  }

  const [orders, store, methods] = await Promise.all([
    getOrdersForPrint(supabase, active.id, ids),
    getStoreInfo(supabase, active.id),
    listPaymentMethods(supabase, active.id),
  ]);

  const sheets = await Promise.all(
    orders.map(async (p) => {
      const url = orderPublicUrl(active, p.order.public_token);
      const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
      return { p, url, qr };
    }),
  );

  return (
    <>
      <style>{format === "80mm" ? PRINT_80 : PRINT_A4}</style>
      <PrintToolbar ids={orders.map((o) => o.order.id)} count={orders.length} format={format} autoPrint={autoPrint && orders.length > 0} />
      <main className="py-6 print:py-0">
        {sheets.length === 0 ? (
          <p className="mx-auto max-w-md rounded-adm border border-adm-border bg-adm-surface p-6 text-sm">
            No encontramos los pedidos para imprimir. Volvé al listado y elegí uno o más pedidos.
          </p>
        ) : (
          sheets.map(({ p, url, qr }) =>
            format === "80mm" ? (
              <Ticket key={p.order.id} p={p} store={store} url={url} qr={qr} methodName={paymentMethodName(methods, p.order.payment_method_code)} />
            ) : (
              <SheetA4 key={p.order.id} p={p} store={store} url={url} qr={qr} methodName={paymentMethodName(methods, p.order.payment_method_code)} />
            ),
          )
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------

interface SheetProps {
  p: PrintableOrder;
  store: StoreInfo;
  url: string;
  qr: string;
  methodName: string;
}

function totalsOf(p: PrintableOrder) {
  const o = p.order;
  return {
    subtotal: Number(o.subtotal),
    promo: Number(o.promo_total),
    coupon: Number(o.coupon_discount),
    payment: Number(o.payment_discount),
    extra: otherDiscount({
      subtotal: Number(o.subtotal),
      promo_total: Number(o.promo_total),
      coupon_discount: Number(o.coupon_discount),
      payment_discount: Number(o.payment_discount),
      discount_total: Number(o.discount_total),
      shipping_cost: Number(o.shipping_cost),
      total: Number(o.total),
    }),
    shipping: Number(o.shipping_cost),
    total: Number(o.total),
    balance: o.status === "cancelled" ? 0 : balanceDue(Number(o.total), amountPaid([{ amount: p.paid }])),
  };
}

function paymentLabel(status: string) {
  return isPaymentStatus(status) ? PAYMENT_STATUS_LABELS[status] : status;
}

function SheetA4({ p, store, url, qr, methodName }: SheetProps) {
  const o = p.order;
  const money = (v: number) => formatMoney(v, { currency: o.currency });
  const t = totalsOf(p);
  const address = parseAddress(o.shipping_address);

  return (
    <article className="remito-sheet mx-auto mb-6 w-[210mm] max-w-full bg-white p-[12mm] text-[12px] leading-snug text-black shadow-[0_1px_3px_rgb(0_0_0/0.15)] print:m-0 print:w-auto print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b border-black pb-3">
        <div className="min-w-0">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo de la tienda en una hoja para imprimir
            <img src={store.logoUrl} alt={store.name} className="mb-1 max-h-12 max-w-[60mm] object-contain" />
          ) : (
            <p className="text-lg font-semibold">{store.name}</p>
          )}
          {store.address ? <p>{store.address}</p> : null}
          {store.contactPhone || store.whatsappPhone ? <p>Tel.: {store.contactPhone ?? `+${store.whatsappPhone}`}</p> : null}
          {store.contactEmail ? <p>{store.contactEmail}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] tracking-wide uppercase">Remito · Documento no válido como factura</p>
          <p className="tnum text-2xl font-semibold">#{o.number}</p>
          <p className="tnum">{formatDateTime(o.created_at, store.timezone)}</p>
          {o.status === "cancelled" ? <p className="mt-1 font-semibold">PEDIDO CANCELADO</p> : null}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b border-black/30 py-3">
        <div>
          <h2 className="mb-1 text-[11px] font-semibold tracking-wide uppercase">Cliente</h2>
          <p className="font-medium">{p.customer.name}</p>
          {p.customer.phone ? <p className="tnum">{p.customer.phone}</p> : null}
          {p.customer.email ? <p>{p.customer.email}</p> : null}
          {p.customer.doc ? <p className="tnum">DNI/CUIT: {p.customer.doc}</p> : null}
        </div>
        <div>
          <h2 className="mb-1 text-[11px] font-semibold tracking-wide uppercase">
            {o.fulfillment === "pickup" ? "Retiro en el local" : "Envío"}
          </h2>
          {o.fulfillment === "pickup" ? (
            <>
              <p className="font-medium">{p.pickup?.name ?? "Retira en el local"}</p>
              {p.pickup?.address ? <p>{p.pickup.address}</p> : null}
              {p.pickup?.hours_text ? <p>{p.pickup.hours_text}</p> : null}
            </>
          ) : (
            <>
              {addressLines(address).map((l) => (
                <p key={l}>{l}</p>
              ))}
              {address?.notes ? <p className="italic">{address.notes}</p> : null}
              {o.shipping_zone_name ? <p>Zona: {o.shipping_zone_name}</p> : null}
              {o.tracking_number ? (
                <p className="tnum">
                  {o.tracking_carrier ? `${o.tracking_carrier}: ` : "Seguimiento: "}
                  {o.tracking_number}
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left text-[11px] uppercase">
            <th className="w-6 py-1.5 font-semibold">
              <span className="sr-only">Control</span>
            </th>
            <th className="w-10 py-1.5 text-right font-semibold">Cant.</th>
            <th className="py-1.5 pl-3 font-semibold">Producto</th>
            <th className="py-1.5 pl-3 font-semibold">SKU</th>
            <th className="py-1.5 text-right font-semibold">P. unit.</th>
            <th className="py-1.5 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((it) => (
            <tr key={it.id} className="border-b border-black/20 align-top">
              <td className="py-1.5">
                <span aria-hidden className="mt-0.5 inline-block size-3 border border-black" />
              </td>
              <td className="tnum py-1.5 text-right font-semibold">{it.qty}</td>
              <td className="py-1.5 pl-3">
                {it.name}
                {it.variant_title ? <span className="block text-[11px]">{it.variant_title}</span> : null}
              </td>
              <td className="py-1.5 pl-3 font-mono text-[11px]">{it.sku ?? "—"}</td>
              <td className="tnum py-1.5 text-right whitespace-nowrap">{money(Number(it.unit_price))}</td>
              <td className="tnum py-1.5 text-right whitespace-nowrap">{money(Number(it.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="max-w-[95mm] space-y-2">
          <p>
            <span className="font-semibold">Pago:</span> {methodName} · {paymentLabel(o.payment_status)}
            {t.balance > 0 && o.payment_status !== "pending" ? ` · Saldo ${money(t.balance)}` : ""}
          </p>
          {o.notes ? (
            <div>
              <p className="font-semibold">Notas del cliente</p>
              <p className="whitespace-pre-line">{o.notes}</p>
            </div>
          ) : null}
        </div>
        <dl className="tnum w-[70mm] shrink-0 space-y-0.5">
          <Row label="Subtotal" value={money(t.subtotal)} />
          {t.promo > 0 ? <Row label="Promociones" value={`− ${money(t.promo)}`} /> : null}
          {t.coupon > 0 ? <Row label={`Cupón ${o.coupon_code ?? ""}`} value={`− ${money(t.coupon)}`} /> : null}
          {t.payment > 0 ? <Row label="Descuento por pago" value={`− ${money(t.payment)}`} /> : null}
          {t.extra > 0 ? <Row label="Descuento" value={`− ${money(t.extra)}`} /> : null}
          <Row label={o.fulfillment === "pickup" ? "Retiro" : "Envío"} value={t.shipping > 0 ? money(t.shipping) : "Sin cargo"} />
          <div className="flex justify-between border-t border-black pt-1 text-sm font-semibold">
            <dt>Total</dt>
            <dd>{money(t.total)}</dd>
          </div>
        </dl>
      </div>

      <footer className="mt-6 flex items-center gap-4 border-t border-black/30 pt-3">
        <div className="size-[26mm] shrink-0 [&_svg]:size-full" aria-hidden dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="min-w-0 text-[11px]">
          <p className="font-semibold">Seguí tu pedido</p>
          <p className="break-all">{url}</p>
          <p className="mt-1">Gracias por tu compra en {store.name}.</p>
        </div>
      </footer>
    </article>
  );
}

function Ticket({ p, store, url, qr, methodName }: SheetProps) {
  const o = p.order;
  const money = (v: number) => formatMoney(v, { currency: o.currency });
  const t = totalsOf(p);
  const address = parseAddress(o.shipping_address);

  return (
    <article className="remito-sheet mx-auto mb-6 w-[80mm] bg-white p-[4mm] text-[11px] leading-snug text-black shadow-[0_1px_3px_rgb(0_0_0/0.15)] print:m-0 print:w-auto print:p-0 print:shadow-none">
      <header className="border-b border-dashed border-black pb-2 text-center">
        <p className="text-sm font-semibold">{store.name}</p>
        {store.address ? <p>{store.address}</p> : null}
        <p className="tnum mt-1 text-lg font-semibold">#{o.number}</p>
        <p className="tnum">{formatDateTime(o.created_at, store.timezone)}</p>
        {o.status === "cancelled" ? <p className="font-semibold">CANCELADO</p> : null}
      </header>
      <section className="border-b border-dashed border-black py-2">
        <p className="font-semibold">{p.customer.name}</p>
        {p.customer.phone ? <p className="tnum">{p.customer.phone}</p> : null}
        {o.fulfillment === "pickup" ? (
          <p>Retiro: {p.pickup?.name ?? "en el local"}</p>
        ) : (
          <>
            {addressLines(address).map((l) => (
              <p key={l}>{l}</p>
            ))}
            {address?.notes ? <p className="italic">{address.notes}</p> : null}
          </>
        )}
      </section>
      <ul className="border-b border-dashed border-black py-2">
        {p.items.map((it) => (
          <li key={it.id} className="py-0.5">
            <div className="flex justify-between gap-2">
              <span>
                <span className="tnum font-semibold">{it.qty} ×</span> {it.name}
              </span>
              <span className="tnum whitespace-nowrap">{money(Number(it.total))}</span>
            </div>
            {it.variant_title || it.sku ? (
              <p className="text-[10px]">
                {[it.variant_title, it.sku ? `SKU ${it.sku}` : null].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <dl className="tnum space-y-0.5 border-b border-dashed border-black py-2">
        <Row label="Subtotal" value={money(t.subtotal)} />
        {t.promo + t.coupon + t.payment + t.extra > 0 ? (
          <Row label="Descuentos" value={`− ${money(t.promo + t.coupon + t.payment + t.extra)}`} />
        ) : null}
        <Row label={o.fulfillment === "pickup" ? "Retiro" : "Envío"} value={t.shipping > 0 ? money(t.shipping) : "Sin cargo"} />
        <div className="flex justify-between text-sm font-semibold">
          <dt>Total</dt>
          <dd>{money(t.total)}</dd>
        </div>
      </dl>
      <p className="py-2">
        {methodName} · {paymentLabel(o.payment_status)}
      </p>
      {o.notes ? <p className="border-t border-dashed border-black py-2 whitespace-pre-line">Nota: {o.notes}</p> : null}
      <div className="flex flex-col items-center gap-1 border-t border-dashed border-black pt-2 text-center">
        <div className={cn("size-[30mm] [&_svg]:size-full")} aria-hidden dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="text-[10px] break-all">{url}</p>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

const PRINT_A4 = `
@page { size: A4; margin: 12mm; }
@media print {
  html, body, .admin-root, .remito-root { background: #fff !important; min-height: 0 !important; }
  .remito-sheet { break-after: page; page-break-after: always; }
  .remito-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`;

const PRINT_80 = `
@page { size: 80mm auto; margin: 3mm; }
@media print {
  html, body, .admin-root, .remito-root { background: #fff !important; min-height: 0 !important; }
  .remito-sheet { break-after: page; page-break-after: always; }
  .remito-sheet:last-child { break-after: auto; page-break-after: auto; }
}
`;
