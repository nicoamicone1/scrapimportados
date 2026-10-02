import { FileBox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuoteStatusBadge } from "@/components/admin/print3d/production/bits";
import { QuoteReview } from "@/components/admin/print3d/production/QuoteReview";
import { PageHeader } from "@/components/ui/display";
import { catalogRef, getQuoteDetail, getWorkshop } from "@/lib/admin/print3d-production";
import { todayYmd } from "@/lib/admin/print3d-production-utils";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { hasModule } from "@/lib/modules/registry";
import { storeUrl } from "@/lib/tenant/urls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Cotización · Taller 3D" };

export default async function QuoteDetailPage({ params }: PageProps<"/admin/taller-3d/cotizaciones/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const [quote, workshop] = await Promise.all([getQuoteDetail(ctx.supabase, ctx.store.id, id), getWorkshop(ctx.supabase, ctx.store.id)]);
  if (!quote) notFound();

  const tz = workshop.timezone;
  const name = quote.contact.name ?? "Sin nombre";
  const expired = quote.status === "priced" && new Date(quote.expires_at) < new Date();
  // Grilla del visor: la cama más grande de las impresoras activas.
  const bed =
    workshop.printers
      .filter((p) => p.status === "active")
      .map((p) => p.bed)
      .sort((a, b) => b[0] * b[1] * b[2] - a[0] * a[1] * a[2])[0] ?? null;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Cotizaciones", href: "/admin/taller-3d/cotizaciones" }, { label: name }]}
        section="store"
        icon={<FileBox />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>Cotización de {name}</span>
            <QuoteStatusBadge status={quote.status} />
          </span>
        }
        description={
          <>
            <time dateTime={quote.created_at} title={formatDateTime(quote.created_at, tz)}>
              Recibida {formatRelative(quote.created_at)}
            </time>
            {" · "}
            {quote.items.length} {quote.items.length === 1 ? "archivo" : "archivos"}
            {quote.status === "priced" ? ` · ${expired ? "venció" : "vale hasta"} el ${formatDateTime(quote.expires_at, tz)}` : ""}
            {quote.reviewed_at ? ` · revisada por ${quote.reviewer ?? "el equipo"} ${formatRelative(quote.reviewed_at)}` : ""}
          </>
        }
      />

      {quote.status === "ordered" && quote.order_id ? (
        <div className="mb-4 rounded-adm border border-adm-border bg-adm-accent-soft px-4 py-3 text-[13px]">
          Se convirtió en el{" "}
          <Link href={`/admin/pedidos/${quote.order_id}`} className="tnum font-semibold text-adm-accent hover:underline">
            pedido #{quote.order_number ?? ""}
          </Link>
          . Sus trabajos ya están en la cola.
        </div>
      ) : quote.status === "rejected" ? (
        <div className="mb-4 rounded-adm border border-adm-border bg-adm-surface-2 px-4 py-3 text-[13px]">
          Rechazada. Si la volvés a aprobar con un precio, el cliente la puede pagar desde el mismo link.
        </div>
      ) : quote.status === "expired" || expired ? (
        <div className="mb-4 rounded-adm border border-adm-border bg-adm-surface-2 px-4 py-3 text-[13px]">
          Venció sin que la pidan. Aprobala de nuevo para darle otra validez.
        </div>
      ) : null}

      <QuoteReview
        quote={quote}
        catalog={catalogRef(workshop)}
        settings={workshop.settings}
        validDays={workshop.settings.quote_valid_days}
        bed={bed}
        today={todayYmd(tz)}
        publicUrl={storeUrl(ctx.store, `/impresion-3d/c/${quote.token}`)}
        storeName={ctx.store.name}
      />
    </>
  );
}
