import { FileBox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { QuoteStatusBadge } from "@/components/admin/print3d/production/bits";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { TabsNav } from "@/components/ui/Tabs";
import { UrlPendingScope } from "@/components/ui/useUrlTransition";
import { listQuotes, QUOTES_PER_PAGE } from "@/lib/admin/print3d-production";
import { formatYmdShort, isQuoteStatus, QUOTE_STATUS_LABELS, QUOTE_STATUSES, type QuoteStatus } from "@/lib/admin/print3d-production-utils";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/money";
import { hasModule } from "@/lib/modules/registry";
import { storeHref } from "@/lib/tenant/urls";

export const metadata: Metadata = { title: "Cotizaciones · Taller 3D" };

const BASE = "/admin/taller-3d/cotizaciones";

export default async function QuotesPage({ searchParams }: PageProps<"/admin/taller-3d/cotizaciones">) {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const status: QuoteStatus | null = isQuoteStatus(str(sp.estado)) ? (str(sp.estado) as QuoteStatus) : null;
  const q = str(sp.q);
  const page = Math.max(1, Number.parseInt(str(sp.page), 10) || 1);

  const { rows, total, counts } = await listQuotes(ctx.supabase, ctx.store.id, { status, q, page });

  const tabHref = (s: QuoteStatus | null) => {
    const p = new URLSearchParams();
    if (s) p.set("estado", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  };

  const description = counts.all
    ? [
        counts.pending_review ? `${formatNumber(counts.pending_review)} por revisar` : "Nada por revisar",
        `${formatNumber(counts.priced)} cotizadas sin pedir`,
        `${formatNumber(counts.ordered)} convertidas en pedido`,
      ].join(" · ")
    : "Cuando alguien suba un STL en tu cotizador, aparece acá.";

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        description={description}
        section="store"
        icon={<FileBox />}
        actions={
          <ButtonLink href={storeHref(ctx.store, "/impresion-3d")} external>
            Abrir el cotizador
          </ButtonLink>
        }
      >
        <TabsNav
          label="Estado de la cotización"
          items={[
            { href: tabHref(null), label: "Todas", active: status === null, count: counts.all },
            ...QUOTE_STATUSES.map((s) => ({ href: tabHref(s), label: QUOTE_STATUS_LABELS[s], active: status === s, count: counts[s] })),
          ]}
        />
      </PageHeader>

      <UrlPendingScope>
        <div className="mb-3">
          <SearchInput placeholder="Buscar por nombre, mail, teléfono o código" className="w-full sm:w-80" aria-label="Buscar cotizaciones" />
        </div>
        <Table>
          <THead>
            <tr>
              <TH>Cliente</TH>
              <TH>Piezas</TH>
              <TH>Estado</TH>
              <TH numeric>Total</TH>
              <TH>Listo aprox.</TH>
              <TH>Recibida</TH>
            </tr>
          </THead>
          <TBody>
            {rows.length ? (
              rows.map((r) => (
                <TR key={r.id}>
                  <TD className="max-w-[260px]">
                    <Link href={`${BASE}/${r.id}`} className="block truncate font-medium text-adm-fg hover:text-adm-accent hover:underline">
                      {r.contact.name ?? "Sin nombre"}
                    </Link>
                    <span className="block truncate text-xs text-adm-fg-muted">
                      {r.contact.email ?? r.contact.phone ?? <span className="font-mono">{r.token.slice(0, 8)}</span>}
                    </span>
                  </TD>
                  <TD className="max-w-[260px]">
                    <span className="block truncate" title={r.files.join(", ")}>
                      {r.files[0] ?? "—"}
                      {r.files.length > 1 ? <span className="text-adm-fg-muted"> y {r.files.length - 1} más</span> : null}
                    </span>
                    <span className="tnum block text-xs text-adm-fg-muted">
                      {r.pieces} {r.pieces === 1 ? "unidad" : "unidades"}
                      {r.reviewItems ? ` · ${r.reviewItems} en revisión` : ""}
                    </span>
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-0.5">
                      <QuoteStatusBadge status={r.status} />
                      {r.status === "ordered" && r.order_id && r.order_number ? (
                        <Link href={`/admin/pedidos/${r.order_id}`} className="tnum text-xs text-adm-accent hover:underline">
                          Pedido #{r.order_number}
                        </Link>
                      ) : null}
                    </div>
                  </TD>
                  <TD numeric className="font-medium">
                    {r.total !== null && r.status !== "pending_review" ? formatMoney(r.total) : <span className="text-adm-fg-muted">A definir</span>}
                  </TD>
                  <TD muted className="whitespace-nowrap">
                    {formatYmdShort(r.estimated_ready_date)}
                  </TD>
                  <TD muted className="whitespace-nowrap">
                    <time dateTime={r.created_at} title={formatDateTime(r.created_at)}>
                      {formatRelative(r.created_at)}
                    </time>
                  </TD>
                </TR>
              ))
            ) : (
              <TableEmpty
                colSpan={6}
                title={q || status ? "No hay cotizaciones con estos filtros." : "Todavía no hay cotizaciones"}
                description={
                  q || status
                    ? undefined
                    : "Compartí el link del cotizador (/impresion-3d) en tu Instagram o WhatsApp: el cliente sube el STL y ve el precio al instante."
                }
                action={
                  q || status ? (
                    <ButtonLink href={BASE} size="sm">
                      Limpiar filtros
                    </ButtonLink>
                  ) : undefined
                }
              />
            )}
          </TBody>
        </Table>
        <Pagination page={page} perPage={QUOTES_PER_PAGE} total={total} />
      </UrlPendingScope>
    </>
  );
}
