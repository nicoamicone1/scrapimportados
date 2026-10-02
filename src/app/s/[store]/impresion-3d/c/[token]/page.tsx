import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CopyCurrentUrl } from "@/components/store/CopyButton";
import { BoxSketch } from "@/components/store/print3d/BoxSketch";
import { QuoteCheckout } from "@/components/store/print3d/QuoteCheckout";
import {
  STATUS_COPY,
  describeChoice,
  formatDims,
  formatGrams,
  formatPrintTime,
  formatReadyDate,
  type PublicQuote,
} from "@/components/store/print3d/shared";
import { StoreLink } from "@/components/store/StoreLink";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { REVIEW_REASON_LABELS } from "@/lib/print3d";
import { requireStore } from "@/lib/store/context";
import { getStoreDisplay } from "@/lib/store/display";
import { storeHasModule } from "@/lib/store/modules";
import { findPolicy } from "@/lib/store/policies";
import { fetchPaymentMethodsFresh } from "@/lib/store/payment-methods";
import { getPrint3dQuote } from "@/lib/store/print3d";
import { fetchPickupLocationsFresh } from "@/lib/store/shipping";
import { absoluteUrl } from "@/lib/store/seo";
import { waLink } from "@/lib/store/whatsapp";

export const metadata: Metadata = {
  title: "Tu cotización de impresión 3D",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Props = PageProps<"/s/[store]/impresion-3d/c/[token]">;

function StatusBlock({ quote, timezone, whatsappHref }: { quote: PublicQuote; timezone: string; whatsappHref: string | null }) {
  const status = STATUS_COPY[quote.status];
  const dot = (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", status.tone)}>
      <span className="status-dot" aria-hidden />
      {status.label}
    </span>
  );
  switch (quote.status) {
    case "pending_review":
      return (
        <div className="space-y-1">
          {dot}
          <p>El taller está revisando tu pedido. Te contestamos por WhatsApp o mail con el precio final.</p>
          <p className="text-sm text-fg-muted">Guardá este link: acá vas a ver la cotización cuando esté lista.</p>
        </div>
      );
    case "priced":
      return (
        <div className="space-y-1">
          {dot}
          <p>
            Precio confirmado{quote.expiresAt ? <> hasta el {formatDateTime(quote.expiresAt, timezone)} h</> : null}. Completá tus datos abajo para pedirla.
          </p>
        </div>
      );
    case "ordered":
      return (
        <div className="space-y-2">
          {dot}
          <p>Ya la pediste{quote.orderNumber ? ` (pedido #${quote.orderNumber})` : ""}: está en la cola de impresión.</p>
          {quote.orderToken ? (
            <StoreLink href={`/pedido/${quote.orderToken}`} className="btn btn-solid">
              Ver mi pedido
            </StoreLink>
          ) : null}
        </div>
      );
    case "expired":
      return (
        <div className="space-y-2">
          {dot}
          <p>La cotización venció. Los precios del filamento cambian: volvé a subir los archivos para cotizar con los de hoy.</p>
          <StoreLink href="/impresion-3d" className="btn btn-solid">
            Cotizar de nuevo
          </StoreLink>
        </div>
      );
    case "rejected":
      return (
        <div className="space-y-2">
          {dot}
          <p>Por ahora no podemos imprimir esta pieza{quote.reviewNote ? "" : ". Escribinos y vemos alternativas"}.</p>
          {whatsappHref ? (
            <a href={whatsappHref} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </a>
          ) : null}
        </div>
      );
  }
}

export default async function Print3dQuotePage({ params }: Props) {
  const { store } = await requireStore(params);
  const { token } = await params;
  const [active, quote, display] = await Promise.all([
    storeHasModule(store.id, "print3d"),
    getPrint3dQuote(store.id, token.trim().toLowerCase()),
    getStoreDisplay(store.id),
  ]);
  if (!active || !quote) notFound();

  const { settings, zones } = display;
  const timezone = settings.timezone;
  const phone = settings.whatsapp_phone ?? "";
  const quoteUrl = absoluteUrl(store, `/impresion-3d/c/${quote.token}`);
  const whatsappHref = phone ? waLink(phone, `Hola. Te escribo por mi cotización de impresión 3D: ${quoteUrl}`) : null;
  const readyDate = formatReadyDate(quote.estimatedReadyDate);
  const canOrder = quote.status === "priced";
  const showPrices = quote.status !== "rejected";

  // Medios de pago y retiro SIN caché (lo que se muestra es lo que se cobra), sólo si se puede pedir.
  const [paymentMethods, pickups] = canOrder
    ? await Promise.all([fetchPaymentMethodsFresh(store.id), fetchPickupLocationsFresh(store.id)])
    : [[], []];
  const terms = settings.policies.terms_md ? `/politicas/${findPolicy("terms")!.slug}` : null;

  const totals = (
    <dl className="tnum space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-fg-muted">Subtotal</dt>
        <dd>{formatMoney(quote.subtotal)}</dd>
      </div>
      {quote.setupFee > 0 ? (
        <div className="flex justify-between">
          <dt className="text-fg-muted">Preparación del pedido</dt>
          <dd>{formatMoney(quote.setupFee)}</dd>
        </div>
      ) : null}
      {quote.minAdjustment > 0 ? (
        <div className="flex justify-between">
          <dt className="text-fg-muted">Ajuste a pedido mínimo</dt>
          <dd>{formatMoney(quote.minAdjustment)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
        <dt>{quote.status === "pending_review" ? "Total estimado" : "Total"}</dt>
        <dd>{formatMoney(quote.total)}</dd>
      </div>
      {canOrder ? <p className="text-xs text-fg-muted">Sin el envío: lo calculás con tu dirección.</p> : null}
    </dl>
  );

  const readyLine =
    readyDate && (quote.status === "priced" || quote.status === "ordered") ? (
      <p className="flex gap-2 text-sm">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Lista aprox. el <strong className="font-semibold">{readyDate}</strong>
          <span className="block text-xs text-fg-muted">Fecha estimada al cotizar. Sin contar el envío.</span>
        </span>
      </p>
    ) : null;

  return (
    <div className="store-container py-[var(--space-section-sm)]">
      <p className="eyebrow">Impresión 3D · cotización</p>
      <h1 className="h-page mt-1.5">
        {quote.status === "ordered" ? "Tu impresión está pedida" : quote.status === "pending_review" ? "Recibimos tus archivos" : "Tu cotización"}
      </h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,560px)_380px] lg:justify-between">
        <div className="min-w-0 space-y-6">
          <div className="rounded-md border border-border p-4">
            <StatusBlock quote={quote} timezone={timezone} whatsappHref={whatsappHref} />
            {quote.reviewNote ? (
              <blockquote className="mt-3 border-l-2 border-border-strong pl-3 text-sm">
                <p className="text-xs text-fg-muted">Nota del taller</p>
                <p className="mt-0.5 whitespace-pre-line">{quote.reviewNote}</p>
              </blockquote>
            ) : null}
          </div>

          {/* Piezas */}
          <section aria-labelledby="piezas">
            <h2 id="piezas" className="text-base font-semibold">
              Piezas <span className="tnum font-normal text-fg-muted">({quote.items.length})</span>
            </h2>
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {quote.items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  <span className="grid size-16 shrink-0 place-items-center rounded-sm border border-border bg-surface text-fg-muted">
                    <BoxSketch bbox={item.geometry?.bbox ?? null} hex={item.colorHex} className="size-11" />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">
                      {item.qty > 1 ? <span className="tnum">{item.qty} × </span> : null}
                      {item.fileName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                      <span className="inline-block size-3 shrink-0 rounded-sm border border-border-strong" style={{ backgroundColor: item.colorHex }} aria-hidden />
                      <span className="min-w-0">
                        {describeChoice({
                          materialName: item.materialName,
                          colorName: item.colorName,
                          qualityName: item.qualityName,
                          infillPct: item.infillPct,
                          supports: item.supports,
                        })}
                      </span>
                    </p>
                    <p className="tnum mt-0.5 text-xs text-fg-muted">
                      {item.geometry ? `${formatDims(item.geometry.bbox)} · ` : ""}
                      {formatGrams(item.grams)} · {formatPrintTime(item.minutes)} por unidad
                    </p>
                    {item.needsReview && quote.status === "pending_review" && item.reviewReasons.length ? (
                      <p className="mt-1 text-xs text-accent">{item.reviewReasons.map((r) => REVIEW_REASON_LABELS[r]).join(" · ")}</p>
                    ) : null}
                  </div>
                  {showPrices ? (
                    <div className="tnum shrink-0 text-right text-sm">
                      <p>{formatMoney(item.total)}</p>
                      {item.qty > 1 ? <p className="text-xs text-fg-muted">{formatMoney(item.unitPrice)} c/u</p> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Resumen en mobile (en desktop va a la derecha) */}
          {showPrices ? (
            <div className="space-y-4 rounded-md border border-border bg-surface p-4 lg:hidden">
              {totals}
              {readyLine}
            </div>
          ) : null}

          {canOrder ? (
            <section aria-label="Pedir la impresión" className="border-t border-border">
              <QuoteCheckout
                token={quote.token}
                quoteTotal={quote.total}
                paymentMethods={paymentMethods.map((m) => ({
                  code: m.code,
                  name: m.name,
                  type: m.type,
                  discountPercent: m.discountPercent,
                  instructions: m.instructionsMd ?? "",
                }))}
                pickups={pickups.map((p) => ({ id: p.id, name: p.name, address: p.address ?? "", hours: p.hoursText ?? "" }))}
                hasZones={zones.length > 0}
                requirePhone={settings.checkout.require_phone}
                notesEnabled={settings.checkout.order_notes_enabled}
                whatsappPhone={phone}
                termsHref={terms}
              />
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
            <span>Guardá este link para volver a tu cotización.</span>
            <CopyCurrentUrl />
          </div>
        </div>

        <aside className="hidden lg:block" aria-label="Resumen de la cotización">
          <div className="sticky top-[calc(var(--header-h)+24px)] space-y-4 rounded-lg border border-border bg-surface p-5">
            <p className="font-semibold">Resumen</p>
            {showPrices ? totals : <p className="text-sm text-fg-muted">Sin precio: el taller no la puede imprimir así.</p>}
            {readyLine}
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="link block text-sm">
                Consultar por WhatsApp
              </a>
            ) : null}
          </div>
        </aside>
      </div>

    </div>
  );
}
