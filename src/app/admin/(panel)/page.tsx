import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { NotificationsToggle } from "@/components/admin/dashboard/NotificationsToggle";
import { OnboardingChecklist } from "@/components/admin/dashboard/OnboardingChecklist";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { ExpireSweep } from "@/components/admin/orders/ExpireSweep";
import { ExpiryText, OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "@/components/admin/orders/OrderBadges";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader, Stat, StatStrip } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/admin/dashboard";
import { parsePeriod, PERIOD_LABELS, PERIODS } from "@/lib/admin/dashboard-utils";
import { getStoreInfo, sweepExpiredOrders } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import { getPlanChip } from "@/lib/plans/chip";
import { storeHref } from "@/lib/tenant/urls";

export const metadata: Metadata = { title: "Dashboard" };

const SALES_LABEL = { hoy: "Ventas de hoy", "7d": "Ventas 7 días", "30d": "Ventas 30 días" } as const;

/** Dashboard (DESIGN.md §7.8): franja de números, barras de ventas y listas de acción. */
export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const ctx = await requireAdmin();
  const { supabase, profile } = ctx;
  const sp = await searchParams;
  const period = parsePeriod(typeof sp.periodo === "string" ? sp.periodo : undefined);

  const [expired, store] = await Promise.all([sweepExpiredOrders(supabase), getStoreInfo(supabase)]);
  const d = await getDashboard(supabase, period, store);
  const money = (v: number) => formatMoney(v, { currency: store.currency });
  const firstName = (profile.name ?? "").split(" ")[0];

  // Slots para M (multi-tienda): chip del plan junto al nombre de la tienda y
  // checklist de primeros pasos arriba de todo (`<OnboardingChecklist />`).
  const chip = getPlanChip(ctx);
  const planChip: ReactNode = (
    <Link href="/admin/plan" className="rounded-adm-sm text-[0px] leading-none" title="Ver plan">
      <Badge tone={chip.tone === "trial" ? "amber" : chip.tone === "warning" ? "red" : "accent"}>{chip.label}</Badge>
    </Link>
  );
  const onboarding: ReactNode = <OnboardingChecklist ctx={ctx} />;

  const header = (
    <PageHeader
      title={
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span>{ctx.store.name}</span>
          {planChip}
        </span>
      }
      description={firstName ? `Hola, ${firstName}. Así viene tu tienda.` : "Así viene tu tienda."}
      actions={
        <>
          <NotificationsToggle />
          <ButtonLink href={storeHref(ctx.store)} external icon={<ExternalLink />}>
            Ver tienda
          </ButtonLink>
        </>
      }
    >
      {d.totalOrders ? (
        <TabsNav
          label="Período"
          items={PERIODS.map((p) => ({
            href: p === "7d" ? "/admin" : `/admin?periodo=${p}`,
            label: PERIOD_LABELS[p],
            active: p === period,
          }))}
        />
      ) : null}
    </PageHeader>
  );

  // ---------- Sin pedidos todavía: qué hacer primero ----------
  if (!d.totalOrders) {
    return (
      <>
        <ExpireSweep expired={expired} />
        {header}
        {onboarding}
        <Card className={cn(onboarding ? "mt-4" : "", "border-[#cfdcd3] bg-adm-accent-soft")}>
          <CardHeader
            className="border-[#cfdcd3]"
            eyebrow="Pedidos"
            title="Todavía no hay pedidos"
            description="Cuando alguien compre en tu tienda lo vas a ver acá. Si vendés por otro lado, cargalo como pedido manual."
            actions={
              <ButtonLink href="/admin/pedidos/nuevo" variant="primary">
                Crear pedido manual
              </ButtonLink>
            }
          />
        </Card>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <LowStockCard d={d} />
          <WithdrawalsCard d={d} />
        </div>
      </>
    );
  }

  const alertUnpaid = d.unpaid.count > 0;

  return (
    <>
      <ExpireSweep expired={expired} />
      {header}
      <div className="mb-4 empty:hidden">{onboarding}</div>

      <StatStrip>
        <Stat label={SALES_LABEL[period]} value={money(d.sales.value)} delta={d.sales.comparison.text} trend={d.sales.comparison.percent === null ? undefined : d.sales.comparison.direction} />
        <Stat
          label="Pedidos"
          value={formatNumber(d.orders.value)}
          delta={d.orders.comparison.text}
          trend={d.orders.comparison.percent === null ? undefined : d.orders.comparison.direction}
          href="/admin/pedidos"
        />
        <Stat label="Ticket promedio" value={money(d.ticket.value)} delta={d.ticket.comparison.text} trend={d.ticket.comparison.percent === null ? undefined : d.ticket.comparison.direction} />
        <Stat
          label="Por cobrar"
          value={money(d.unpaid.amount)}
          delta={
            alertUnpaid
              ? `${formatNumber(d.unpaid.count)} ${d.unpaid.count === 1 ? "pedido pendiente" : "pedidos pendientes"} de pago`
              : "Todo cobrado"
          }
          alert={alertUnpaid}
          href="/admin/pedidos?pago=impago"
        />
      </StatStrip>

      <Card className="mt-4">
        <CardHeader
          title={period === "hoy" ? "Ventas de hoy por hora" : `Ventas de los últimos ${period === "7d" ? "7" : "30"} días`}
          description="Pedidos no cancelados, por fecha de creación."
        />
        <div className="px-4 pt-3 pb-2">
          <SalesChart
            points={d.series}
            currency={store.currency}
            caption={`Ventas por ${period === "hoy" ? "hora" : "día"}: ${money(d.sales.value)} en total.`}
          />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <Card>
            <CardHeader title="Requieren acción" />
            <div className="grid grid-cols-3 divide-x divide-adm-border">
              <ActionLink href="/admin/pedidos?tab=pendientes" count={d.actionCounts.toConfirm} label="Por confirmar" />
              <ActionLink href="/admin/pedidos?tab=preparar" count={d.actionCounts.toShip} label="Para preparar y despachar" />
              <ActionLink href="/admin/pedidos?pago=impago" count={d.actionCounts.unpaid} label="Pagos sin acreditar" />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Últimos pedidos"
              actions={
                <ButtonLink href="/admin/pedidos" size="sm" variant="ghost">
                  Ver todos
                </ButtonLink>
              }
            />
            <ul className="divide-y divide-adm-border">
              {d.recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                  <Link href={`/admin/pedidos/${o.id}`} className={cn("tnum w-14 hover:underline", o.seenAt ? "font-medium" : "font-semibold")}>
                    #{o.number}
                  </Link>
                  <span className="min-w-0 flex-1 truncate">
                    {o.customer.name}
                    <RelativeTime value={o.createdAt} timeZone={store.timezone} className="ml-2 text-xs text-adm-fg-muted" />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                    <PaymentStatusBadge status={o.paymentStatus} />
                  </span>
                  <span className="tnum w-24 text-right font-medium">{formatMoney(o.total, { currency: o.currency })}</span>
                </li>
              ))}
            </ul>
          </Card>

          {d.expiring.length ? (
            <Card>
              <CardHeader
                title="Reservas que vencen pronto"
                description="Pedidos sin pago: si vencen, se cancelan solos y el stock vuelve."
              />
              <ul className="divide-y divide-adm-border">
                {d.expiring.map((o) => (
                  <li key={o.id} className="flex items-center gap-4 px-4 py-2.5 text-[13px]">
                    <Link href={`/admin/pedidos/${o.id}`} className="tnum w-14 font-medium hover:underline">
                      #{o.number}
                    </Link>
                    <span className="min-w-0 flex-1 truncate">{o.customer.name}</span>
                    <ExpiryText expiresAt={o.expiresAt} timeZone={store.timezone} />
                    <span className="tnum w-24 text-right">{formatMoney(o.total, { currency: o.currency })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader title="Más vendidos" description={PERIOD_LABELS[period]} />
            {d.topProducts.length ? (
              <ol className="divide-y divide-adm-border">
                {d.topProducts.map((p, i) => (
                  <li key={`${p.productId ?? p.name}-${i}`} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="tnum w-4 text-adm-fg-muted">{i + 1}</span>
                    {p.productId ? (
                      <Link href={`/admin/productos/${p.productId}`} className="min-w-0 flex-1 truncate hover:underline">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    )}
                    <span className="tnum text-right text-adm-fg-muted" title={money(p.revenue)}>
                      {formatNumber(p.qty)} u.
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-3 text-[13px] text-adm-fg-muted">Sin ventas en el período.</p>
            )}
          </Card>
          <LowStockCard d={d} />
          <WithdrawalsCard d={d} />
        </div>
      </div>
    </>
  );
}

function ActionLink({ href, count, label }: { href: string; count: number; label: string }) {
  return (
    <Link href={href} className="group block px-4 py-3 transition-colors hover:bg-adm-row-hover">
      <span className="flex items-center gap-2">
        {count ? <span aria-hidden className="size-1.5 rounded-full bg-adm-accent-2" /> : null}
        <span className={cn("tnum block text-xl font-semibold", count ? "text-adm-fg" : "text-adm-fg-muted")}>{formatNumber(count)}</span>
      </span>
      <span className="text-xs text-adm-fg-muted group-hover:text-adm-fg">{label}</span>
    </Link>
  );
}

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

function LowStockCard({ d }: { d: DashboardData }) {
  return (
    <Card>
      <CardHeader
        title="Stock bajo"
        description={d.lowStock.total ? `${formatNumber(d.lowStock.total)} ${d.lowStock.total === 1 ? "variante" : "variantes"} en o bajo el umbral` : undefined}
        actions={
          <ButtonLink href="/admin/inventario" size="sm" variant="ghost">
            Inventario
          </ButtonLink>
        }
      />
      {d.lowStock.rows.length ? (
        <ul className="divide-y divide-adm-border">
          {d.lowStock.rows.map((v) => (
            <li key={v.variant_id ?? v.sku ?? v.product_name} className="flex items-center gap-3 px-4 py-2 text-[13px]">
              <div className="min-w-0 flex-1">
                {v.product_id ? (
                  <Link href={`/admin/productos/${v.product_id}`} className="block truncate hover:underline">
                    {v.product_name}
                  </Link>
                ) : (
                  <span className="block truncate">{v.product_name}</span>
                )}
                <span className="block truncate text-xs text-adm-fg-muted">
                  {[v.variant_title && v.variant_title !== "Default" ? v.variant_title : null, v.sku].filter(Boolean).join(" · ") || "Sin SKU"}
                </span>
              </div>
              {(v.stock ?? 0) <= 0 ? <Badge tone="red">Sin stock</Badge> : <Badge tone="amber">Quedan {v.stock}</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[13px] text-adm-fg-muted">Ninguna variante está por debajo del umbral.</p>
      )}
    </Card>
  );
}

function WithdrawalsCard({ d }: { d: DashboardData }) {
  return (
    <Card>
      <CardHeader
        title="Arrepentimientos nuevos"
        actions={
          <ButtonLink href="/admin/pedidos/arrepentimientos" size="sm" variant="ghost">
            Ver bandeja
          </ButtonLink>
        }
      />
      {d.withdrawals.rows.length ? (
        <ul className="divide-y divide-adm-border">
          {d.withdrawals.rows.map((w) => (
            <li key={w.id} className="px-4 py-2 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{w.name}</span>
                <span className="font-mono text-xs text-adm-fg-muted">{w.code}</span>
              </div>
              <p className="text-xs text-adm-fg-muted">
                {w.order_number ? `Pedido #${w.order_number} · ` : ""}
                <RelativeTime value={w.created_at} />
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[13px] text-adm-fg-muted">No hay solicitudes pendientes.</p>
      )}
    </Card>
  );
}
