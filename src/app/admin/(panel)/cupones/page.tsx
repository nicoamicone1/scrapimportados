import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CouponActions, CouponActiveSwitch } from "@/components/admin/coupons/CouponActions";
import { LimitBanner } from "@/components/admin/LimitBanner";
import { PlanGate } from "@/components/admin/PlanGate";
import { CouponStatusBadge, discountLabel, scopeSummary, windowSummary } from "@/components/admin/pricing/shared";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Table, TableEmpty, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { TabsNav } from "@/components/ui/Tabs";
import { COUPON_STATUS_PARAM, COUPONS_PER_PAGE, listCoupons, type AdminCoupon } from "@/lib/admin/coupons";
import { getCategoryOptions, getStoreTimezone } from "@/lib/admin/pricing";
import { formatMoney, formatNumber } from "@/lib/money";
import type { CouponStatus } from "@/lib/pricing";

export const metadata: Metadata = { title: "Cupones" };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function conditions(c: AdminCoupon): string {
  const parts: string[] = [];
  if (c.minSubtotal) parts.push(`Mín. ${formatMoney(c.minSubtotal)}`);
  if (c.firstOrderOnly) parts.push("Primera compra");
  if (c.maxUsesPerCustomer) parts.push(c.maxUsesPerCustomer === 1 ? "1 por cliente" : `${c.maxUsesPerCustomer} por cliente`);
  return parts.join(" · ") || "Sin condiciones";
}

export default async function CuponesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q).slice(0, 60);
  const status: CouponStatus | null = COUPON_STATUS_PARAM[first(params.estado)] ?? null;
  const rawPage = Number(first(params.page));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [{ rows, total, counts }, categories, tz] = await Promise.all([
    listCoupons({ q, status, page }),
    getCategoryOptions(),
    getStoreTimezone(),
  ]);

  const tabHref = (value: string) => {
    const sp = new URLSearchParams();
    if (value) sp.set("estado", value);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return qs ? `/admin/cupones?${qs}` : "/admin/cupones";
  };

  const newButton = (
    <PlanGate feature="marketing.coupons" mode="inline" label="Nuevo cupón">
      <ButtonLink href="/admin/cupones/nuevo" variant="primary" icon={<Plus aria-hidden />}>
        Nuevo cupón
      </ButtonLink>
    </PlanGate>
  );

  if (counts.all === 0) {
    return (
      <>
        <PageHeader title="Cupones" actions={newButton} />
        <EmptyState
          title="Todavía no hay cupones"
          description="Creá códigos de descuento (%, monto fijo o envío gratis) con compra mínima, límite de usos y vigencia. Tus clientes los cargan en el checkout."
          actions={newButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cupones"
        description={`${formatNumber(counts.active)} activos · ${formatNumber(counts.all)} en total`}
        actions={newButton}
      >
        <TabsNav
          items={[
            { href: tabHref(""), label: "Todos", active: !status, count: counts.all },
            { href: tabHref("activos"), label: "Activos", active: status === "active", count: counts.active },
            { href: tabHref("programados"), label: "Programados", active: status === "scheduled", count: counts.scheduled },
            { href: tabHref("pausados"), label: "Pausados", active: status === "paused", count: counts.paused },
            { href: tabHref("agotados"), label: "Agotados", active: status === "exhausted", count: counts.exhausted },
            { href: tabHref("vencidos"), label: "Vencidos", active: status === "expired", count: counts.expired },
          ]}
        />
      </PageHeader>

      <LimitBanner limit="coupons" used={counts.all} className="mb-3" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Buscar código…" />
        {q || status ? (
          <ButtonLink href="/admin/cupones" variant="ghost" size="sm">
            Limpiar filtros
          </ButtonLink>
        ) : null}
      </div>

      {/* Mobile: una tarjeta por cupón, con pausar/activar en un toque. */}
      <div className="rounded-adm-lg border border-adm-border bg-adm-surface md:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-[15px] font-semibold text-adm-fg">No hay cupones con estos filtros.</p>
            <div className="mt-3">
              <ButtonLink href="/admin/cupones" size="sm">
                Limpiar filtros
              </ButtonLink>
            </div>
          </div>
        ) : (
          <ul>
            {rows.map((c) => (
              <li key={c.id} className="flex items-center border-b border-adm-border last:border-b-0">
                <Link href={`/admin/cupones/${c.id}`} className="block min-h-16 min-w-0 flex-1 px-4 py-3">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-mono text-[13px] font-medium text-adm-fg">{c.code}</span>
                    <span className="tnum text-[13px] text-adm-fg">{discountLabel(c.type, c.value)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-adm-fg-muted">{conditions(c)}</span>
                  <span className="tnum mt-0.5 block truncate text-xs text-adm-fg-muted">
                    {formatNumber(c.usesCount)}
                    {c.maxUses != null ? ` de ${formatNumber(c.maxUses)} usos` : " usos, sin límite"} · {windowSummary(c.startsAt, c.endsAt, tz)}
                  </span>
                  <span className="mt-1.5 inline-flex">
                    <CouponStatusBadge status={c.status} />
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-2 pr-1">
                  <CouponActiveSwitch id={c.id} code={c.code} isActive={c.isActive} />
                  <CouponActions id={c.id} code={c.code} isActive={c.isActive} usesCount={c.usesCount} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Table containerClassName="hidden md:block">
        <THead>
          <tr>
            <TH>Código</TH>
            <TH numeric>Descuento</TH>
            <TH className="hidden lg:table-cell">Condiciones</TH>
            <TH className="hidden xl:table-cell">Alcance</TH>
            <TH numeric>Usos</TH>
            <TH>Vigencia</TH>
            <TH>Estado</TH>
            <TH className="w-24">
              <span className="sr-only">Activo y acciones</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TableEmpty
              colSpan={8}
              title="No hay cupones con estos filtros."
              action={
                <ButtonLink href="/admin/cupones" size="sm">
                  Limpiar filtros
                </ButtonLink>
              }
            />
          ) : (
            rows.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/admin/cupones/${c.id}`} className="font-mono text-[13px] font-medium text-adm-fg hover:underline">
                    {c.code}
                  </Link>
                </TD>
                <TD numeric>{discountLabel(c.type, c.value)}</TD>
                <TD className="hidden max-w-[240px] truncate text-adm-fg-muted lg:table-cell">{conditions(c)}</TD>
                <TD className="hidden max-w-[200px] truncate text-adm-fg-muted xl:table-cell">{scopeSummary(c, categories)}</TD>
                <TD numeric>
                  {formatNumber(c.usesCount)}
                  <span className="text-adm-fg-muted">{c.maxUses != null ? ` / ${formatNumber(c.maxUses)}` : " / sin límite"}</span>
                </TD>
                <TD className="whitespace-nowrap text-adm-fg-muted">{windowSummary(c.startsAt, c.endsAt, tz)}</TD>
                <TD>
                  <CouponStatusBadge status={c.status} />
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-2">
                    <CouponActiveSwitch id={c.id} code={c.code} isActive={c.isActive} />
                    <CouponActions id={c.id} code={c.code} isActive={c.isActive} usesCount={c.usesCount} />
                  </div>
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>
      <Pagination page={page} perPage={COUPONS_PER_PAGE} total={total} />
    </>
  );
}
