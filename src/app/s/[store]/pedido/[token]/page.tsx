import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { CopyButton, CopyCurrentUrl } from "@/components/store/CopyButton";
import { StoreLink } from "@/components/store/StoreLink";
import { TrackEvent } from "@/components/store/Track";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireStore } from "@/lib/store/context";
import { markdownToHtml } from "@/lib/store/markdown";
import { deliveryText, getOrderByToken, type PublicOrder } from "@/lib/store/orders";
import { absoluteUrl } from "@/lib/store/seo";
import { buildOrderMessage, buildReceiptMessage, waLink } from "@/lib/store/whatsapp";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const STATUS: Record<PublicOrder["status"], { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "text-fg-muted" },
  confirmed: { label: "Confirmado", tone: "text-fg" },
  preparing: { label: "En preparación", tone: "text-fg" },
  shipped: { label: "Enviado", tone: "text-fg" },
  delivered: { label: "Entregado", tone: "text-success" },
  cancelled: { label: "Cancelado", tone: "text-danger" },
};

const PAYMENT: Record<PublicOrder["paymentStatus"], { label: string; tone: string }> = {
  pending: { label: "Sin pagar", tone: "text-fg-muted" },
  partial: { label: "Pago parcial", tone: "text-fg" },
  paid: { label: "Pagado", tone: "text-success" },
  refunded: { label: "Reintegrado", tone: "text-fg-muted" },
};

function StatusText({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      <span className="status-dot" aria-hidden />
      {label}
    </span>
  );
}

/** "jueves 24/09, 18:00" en la zona horaria de la tienda. */
function formatDeadline(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone }).format(d);
  return `${day} ${formatDateTime(iso, timeZone).replace(/\/\d{4}/, "").replace(" ", " a las ")} h`;
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-3 text-right">
        <span className="tnum font-mono text-sm break-all">{value}</span>
        {copy ? <CopyButton value={value.replace(/^\$\s?/, "")} ariaLabel={`Copiar ${label.toLowerCase()}`} /> : null}
      </dd>
    </div>
  );
}

export default async function OrderPage({ params, searchParams }: PageProps<"/s/[store]/pedido/[token]">) {
  const { store, basePath } = await requireStore(params);
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  // getOrderByToken ya descarta pedidos de otra tienda; el chequeo explícito queda por claridad.
  const order = await getOrderByToken(store.id, token);
  if (!order || order.store.id !== store.id) notFound();

  const isNew = sp.nuevo === "1";
  const tz = order.store.timezone;
  const money = (v: number) => formatMoney(v, { currency: order.currency, locale: order.store.locale });
  const url = absoluteUrl(store, `/pedido/${order.token}`);
  const status = STATUS[order.status];
  const payment = PAYMENT[order.paymentStatus];
  const cancelled = order.status === "cancelled";
  const unpaid = order.paymentStatus === "pending" || order.paymentStatus === "partial";
  const method = order.paymentMethod;
  const isTransfer = method?.type === "transfer" || order.paymentMethodCode === "transfer";
  const isWhatsapp = method?.type === "whatsapp" || order.paymentMethodCode === "whatsapp";
  const t = order.transfer;
  const hasBankData = Boolean(t.cbu || t.alias);
  const phone = order.store.whatsappPhone;

  const receiptHref = phone
    ? waLink(phone, `${buildReceiptMessage({ number: order.number, total: order.total, customerName: order.customer.name, storeName: order.store.name, currency: order.currency })} ${url}`)
    : null;
  const orderMessageHref = phone
    ? waLink(
        phone,
        buildOrderMessage({
          template: order.whatsappTemplate,
          number: order.number,
          storeName: order.store.name,
          customerName: order.customer.name,
          items: order.items.map((i) => ({ name: i.name, variantTitle: i.variantTitle, qty: i.qty, total: i.total })),
          total: order.total,
          delivery: deliveryText(order),
          payment: method?.name ?? null,
          url,
          currency: order.currency,
        }),
      )
    : null;
  const bankText = [
    t.bankName && `Banco: ${t.bankName}`,
    t.holder && `Titular: ${t.holder}`,
    t.cbu && `CBU/CVU: ${t.cbu}`,
    t.alias && `Alias: ${t.alias}`,
    t.cuit && `CUIT: ${t.cuit}`,
    `Monto: ${money(order.total)}`,
    `Concepto: Pedido #${order.number}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="store-container max-w-[calc(880px+2*var(--gutter))] py-[var(--space-section-sm)]">
      <TrackEvent
        event="purchase"
        onceKey={`purchase:${order.number}`}
        payload={{
          transaction_id: String(order.number),
          currency: order.currency,
          value: order.total,
          shipping: order.shippingCost,
          coupon: order.couponCode,
          items: order.items.map((i) => ({
            item_id: i.sku || i.variantId || i.id,
            item_name: i.name,
            item_variant: i.variantTitle,
            price: i.unitPrice,
            quantity: i.qty,
          })),
        }}
      />

      <header>
        <p className="eyebrow">{order.store.name}</p>
        <h1 className="h-page mt-1">{cancelled ? `Pedido #${order.number}` : `Recibimos tu pedido #${order.number}`}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-fg-muted">{formatDateTime(order.createdAt, tz)}</span>
          <StatusText {...status} />
          <StatusText {...payment} />
        </p>
      </header>

      {/* La acción va primero (DESIGN.md §6.11) */}
      {!cancelled && unpaid && isTransfer ? (
        <section className="mt-6 rounded-lg border border-border bg-surface p-5" aria-labelledby="pagar">
          <h2 id="pagar" className="font-body text-base font-semibold tracking-normal normal-case">
            Transferí {money(order.total)}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Poné <strong className="text-fg">#{order.number}</strong> en el concepto o la referencia de la transferencia.
          </p>
          {hasBankData ? (
            <>
              <dl className="mt-4">
                <Row label="Monto a transferir" value={money(order.total)} copy />
                <Row label="Alias" value={t.alias} copy />
                <Row label="CBU / CVU" value={t.cbu} copy />
                <Row label="Titular" value={t.holder} />
                <Row label="CUIT" value={t.cuit} copy />
                <Row label="Banco" value={t.bankName} />
              </dl>
              <div className="mt-2 flex justify-end">
                <CopyButton value={bankText} label="Copiar todos los datos" />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm">Te pasamos los datos bancarios por WhatsApp. Escribinos con el número de pedido.</p>
          )}
          {t.instructionsMd || method?.instructionsMd ? (
            <div
              className="prose-store mt-3 text-sm text-fg-muted"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(t.instructionsMd || method?.instructionsMd || "", basePath) }}
            />
          ) : null}
          {order.expiresAt ? (
            <p className="mt-4 text-sm">
              Te reservamos el stock hasta el <strong>{formatDeadline(order.expiresAt, tz)}</strong>. Si no registramos el pago para esa fecha, el pedido se
              cancela solo.
            </p>
          ) : null}
          {receiptHref ? (
            <a href={receiptHref} target="_blank" rel="noopener noreferrer" className="btn btn-solid btn-block mt-5">
              {hasBankData ? "Enviar comprobante por WhatsApp" : "Pedir los datos por WhatsApp"}
            </a>
          ) : null}
        </section>
      ) : null}

      {!cancelled && isWhatsapp && orderMessageHref ? (
        <section className="mt-6 rounded-lg border border-border bg-surface p-5" aria-labelledby="whatsapp">
          <h2 id="whatsapp" className="font-body text-base font-semibold tracking-normal normal-case">
            Coordiná el pago y la entrega por WhatsApp
          </h2>
          <p className="mt-1 text-sm text-fg-muted">Te abrimos el chat con el pedido armado. {isNew ? "Si no se abrió solo, tocá el botón." : ""}</p>
          <a href={orderMessageHref} target="_blank" rel="noopener noreferrer" className="btn btn-solid btn-block mt-4">
            Abrir WhatsApp
          </a>
        </section>
      ) : null}

      {cancelled ? (
        <p className="mt-6 rounded-lg border border-border p-4 text-sm">
          Este pedido está cancelado{order.cancelReason === "expired" ? " porque venció el plazo para pagar" : ""}. Si creés que es un error, escribinos
          {phone ? (
            <>
              {" "}
              por{" "}
              <a href={waLink(phone, `Hola. Consulto por el pedido #${order.number}.`)} className="link" target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {!cancelled && unpaid ? (
        <section className="mt-8" aria-labelledby="que-sigue">
          <h2 id="que-sigue" className="font-body text-base font-semibold tracking-normal normal-case">
            ¿Qué pasa ahora?
          </h2>
          <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <li className="border-t border-border pt-3">
              <span className="tnum text-fg-muted">1.</span> {isTransfer ? "Transferís y nos mandás el comprobante." : "Acordamos el pago por WhatsApp."}
            </li>
            <li className="border-t border-border pt-3">
              <span className="tnum text-fg-muted">2.</span> Confirmamos el pago y te avisamos.
            </li>
            <li className="border-t border-border pt-3">
              <span className="tnum text-fg-muted">3.</span>{" "}
              {order.fulfillment === "pickup" ? "Preparamos el pedido y coordinamos el retiro." : "Preparamos y despachamos tu pedido."}
            </li>
          </ol>
        </section>
      ) : null}

      {order.tracking ? (
        <p className="mt-6 text-sm">
          Seguimiento: {order.tracking.carrier ? `${order.tracking.carrier} · ` : ""}
          <span className="font-mono">{order.tracking.number}</span>
          {order.tracking.url && /^https?:\/\//.test(order.tracking.url) ? (
            <>
              {" · "}
              <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="link">
                Ver envío
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-labelledby="detalle">
          <h2 id="detalle" className="font-body text-base font-semibold tracking-normal normal-case">
            Detalle
          </h2>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-3 py-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-surface">
                  {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-contain p-1" /> : null}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p>{i.name}</p>
                  <p className="text-xs text-fg-muted">
                    {i.variantTitle ? `${i.variantTitle} · ` : ""}
                    <span className="tnum">
                      {i.qty} × {money(i.unitPrice)}
                    </span>
                  </p>
                </div>
                <p className="tnum text-sm">{money(i.total)}</p>
              </li>
            ))}
          </ul>
          <dl className="tnum mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-fg-muted">Subtotal</dt>
              <dd>{money(order.subtotal)}</dd>
            </div>
            {order.promoTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-fg-muted">Promociones</dt>
                <dd>−{money(order.promoTotal)}</dd>
              </div>
            ) : null}
            {order.couponDiscount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-fg-muted">Cupón {order.couponCode}</dt>
                <dd>−{money(order.couponDiscount)}</dd>
              </div>
            ) : null}
            {order.paymentDiscount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-fg-muted">
                  {method?.name ?? "Medio de pago"} ({order.paymentDiscountPercent}&nbsp;%)
                </dt>
                <dd>−{money(order.paymentDiscount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-fg-muted">{order.fulfillment === "pickup" ? "Retiro" : "Envío"}</dt>
              <dd>{order.fulfillment === "pickup" || order.shippingCost === 0 ? (order.shippingZoneName?.startsWith("A coordinar") ? "A coordinar" : "Gratis") : money(order.shippingCost)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{money(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-8 lg:col-span-5">
          <section aria-labelledby="entrega">
            <h2 id="entrega" className="font-body text-base font-semibold tracking-normal normal-case">
              {order.fulfillment === "pickup" ? "Retiro" : "Entrega"}
            </h2>
            <div className="mt-2 text-sm text-fg-muted">
              {order.fulfillment === "pickup" ? (
                <>
                  <p className="text-fg">{order.pickupLocation?.name ?? "En el local"}</p>
                  {order.pickupLocation?.address ? <p>{order.pickupLocation.address}</p> : null}
                  {order.pickupLocation?.hoursText ? <p>{order.pickupLocation.hoursText}</p> : null}
                </>
              ) : (
                <>
                  <p className="text-fg">{deliveryText(order).replace(/^Envío a /, "")}</p>
                  {order.shippingAddress?.postal_code ? <p>CP {order.shippingAddress.postal_code}</p> : null}
                  {order.shippingZoneName ? <p>{order.shippingZoneName}</p> : null}
                </>
              )}
              <p className="mt-2">
                {order.customer.name} · {order.customer.email}
                {order.customer.phone ? ` · ${order.customer.phone}` : ""}
              </p>
            </div>
          </section>

          {order.events.length ? (
            <section aria-labelledby="novedades">
              <h2 id="novedades" className="font-body text-base font-semibold tracking-normal normal-case">
                Novedades
              </h2>
              <ol className="mt-3 space-y-3 border-l border-border pl-4">
                {[...order.events].reverse().map((e) => (
                  <li key={e.id}>
                    <p className="tnum text-xs text-fg-muted">{formatDateTime(e.createdAt, tz)}</p>
                    <p className="text-sm">{e.message}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="mt-10 border-t border-border pt-6 text-sm">
        <p>Guardá este link para ver cómo va tu pedido.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <CopyCurrentUrl />
          <a href={waLink(null, `Mi pedido #${order.number} en ${order.store.name}: ${url}`)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Enviármelo por WhatsApp
          </a>
        </div>
        <p className="mt-6 text-xs text-fg-muted">
          Tenés 10 días corridos desde que recibís el producto para arrepentirte de la compra:{" "}
          <StoreLink href={`/arrepentimiento?pedido=${order.number}`} className="link">
            botón de arrepentimiento
          </StoreLink>
          .
        </p>
      </footer>
    </div>
  );
}
