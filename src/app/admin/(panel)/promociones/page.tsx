import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PromoStatusBadge, scopeSummary, windowSummary } from "@/components/admin/pricing/shared";
import { PromotionActions } from "@/components/admin/promotions/PromotionActions";
import { LimitBanner } from "@/components/admin/LimitBanner";
import { PlanGate } from "@/components/admin/PlanGate";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { TabsNav } from "@/components/ui/Tabs";
import { getCategoryOptions, getStoreTimezone } from "@/lib/admin/pricing";
import { listPromotions, PROMO_STATUS_PARAM, PROMOTIONS_PER_PAGE } from "@/lib/admin/promotions";
import { formatNumber } from "@/lib/money";
import { PROMOTION_TYPE_LABELS, promotionValueLabel, type ScheduleStatus } from "@/lib/pricing";

export const metadata: Metadata = { title: "Promociones" };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PromocionesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q).slice(0, 100);
  const estado = first(params.estado);
  const status: ScheduleStatus | null = PROMO_STATUS_PARAM[estado] ?? null;
  const rawPage = Number(first(params.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [{ rows, total, counts }, categories, tz] = await Promise.all([
    listPromotions({ q, status, page }),
    getCategoryOptions(),
    getStoreTimezone(),
  ]);

  const tabHref = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set("estado", value);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return qs ? `/admin/promociones?${qs}` : "/admin/promociones";
  };

  const newButton = (
    <PlanGate feature="marketing.promotions" mode="inline" label="Nueva promoción">
      <ButtonLink href="/admin/promociones/nuevo" variant="primary" icon={<Plus aria-hidden />}>
        Nueva promoción
      </ButtonLink>
    </PlanGate>
  );

  if (counts.all === 0) {
    return (
      <>
        <PageHeader title="Promociones" actions={newButton} />
        <EmptyState
          title="Todavía no hay promociones"
          description="Armá descuentos por porcentaje o monto, 3x2 o 2.ª unidad al 50 % para toda la tienda, categorías o productos, con fecha de inicio y fin. Se aplican solos en las cards, la ficha y el carrito."
          actions={newButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Promociones"
        description={`${formatNumber(counts.active)} activas · ${formatNumber(counts.scheduled)} programadas`}
        actions={newButton}
      >
        <TabsNav
          items={[
            { href: tabHref(""), label: "Todas", active: !status, count: counts.all },
            { href: tabHref("activas"), label: "Activas", active: status === "active", count: counts.active },
            { href: tabHref("programadas"), label: "Programadas", active: status === "scheduled", count: counts.scheduled },
            { href: tabHref("pausadas"), label: "Pausadas", active: status === "paused", count: counts.paused },
            { href: tabHref("vencidas"), label: "Vencidas", active: status === "expired", count: counts.expired },
          ]}
        />
      </PageHeader>

      <LimitBanner limit="promotions" used={counts.all} className="mb-3" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Buscar por nombre o etiqueta…" />
        {q || status ? (
          <ButtonLink href="/admin/promociones" variant="ghost" size="sm">
            Limpiar filtros
          </ButtonLink>
        ) : null}
      </div>

      <Table>
        <THead>
          <tr>
            <TH>Nombre</TH>
            <TH>Tipo</TH>
            <TH numeric>Descuento</TH>
            <TH>Alcance</TH>
            <TH>Vigencia</TH>
            <TH numeric>Prioridad</TH>
            <TH>Acumulable</TH>
            <TH>Estado</TH>
            <TH className="w-12">
              <span className="sr-only">Acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TableEmpty
              colSpan={9}
              title="No hay promociones con estos filtros."
              action={
                <ButtonLink href="/admin/promociones" size="sm">
                  Limpiar filtros
                </ButtonLink>
              }
            />
          ) : (
            rows.map((p) => (
              <TR key={p.id}>
                <TD className="max-w-[300px]">
                  <Link href={`/admin/promociones/${p.id}`} className="flex items-center gap-2 font-medium text-adm-fg hover:underline">
                    <span className="truncate">{p.name}</span>
                    {p.badgeLabel ? (
                      <Badge tone="accent" dot={false}>
                        {p.badgeLabel}
                      </Badge>
                    ) : null}
                  </Link>
                </TD>
                <TD className="whitespace-nowrap text-adm-fg-muted">{PROMOTION_TYPE_LABELS[p.type]}</TD>
                <TD numeric className="whitespace-nowrap">{promotionValueLabel(p)}</TD>
                <TD className="max-w-[240px] truncate text-adm-fg-muted">{scopeSummary(p, categories)}</TD>
                <TD className="whitespace-nowrap text-adm-fg-muted">{windowSummary(p.startsAt, p.endsAt, tz)}</TD>
                <TD numeric>{p.priority}</TD>
                <TD className="text-adm-fg-muted">{p.stackable ? "Sí" : "No"}</TD>
                <TD>
                  <PromoStatusBadge status={p.status} />
                </TD>
                <TD className="text-right">
                  <PromotionActions id={p.id} name={p.name} isActive={p.isActive} />
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      <Pagination page={page} perPage={PROMOTIONS_PER_PAGE} total={total} />
    </>
  );
}
