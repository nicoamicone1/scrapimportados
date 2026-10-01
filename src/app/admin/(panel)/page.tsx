import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CopyStoreLinkButton } from "@/components/admin/dashboard/OnboardingActions";
import { NotificationsToggle } from "@/components/admin/dashboard/NotificationsToggle";
import { OnboardingChecklist } from "@/components/admin/dashboard/OnboardingChecklist";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { ExpireSweep } from "@/components/admin/orders/ExpireSweep";
import { ExpiryText, OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "@/components/admin/orders/OrderBadges";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, PageHeader, Stat, StatStrip } from "@/components/ui/display";
import { TabsNav } from "@/components/ui/Tabs";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/admin/dashboard";
import { parsePeriod, PERIOD_LABELS, PERIODS } from "@/lib/admin/dashboard-utils";
import { getStoreInfo, sweepExpiredOrders } from "@/lib/admin/orders";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import { getOnboardingStatus } from "@/lib/onboarding";
import { storeUrl } from "@/lib/tenant/urls";

export const metadata: Metadata = { title: "Inicio" };

const SALES_LABEL = { hoy: "Ventas de hoy", "7d": "Ventas 7 días", "30d": "Ventas 30 días" } as const;

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

interface TodoItem {
  key: string;
  count: number;
  label: string;
  /** Para el resumen del encabezado ("3 por confirmar"). */
  short: string;
  hint: string;
  href: string;
}

/**
 * Inicio del panel (DESIGN.md §7.8, UX audit admin-shell): contesta primero
 * "¿qué tengo que hacer hoy?" (lista "Para hacer" con contadores que llevan a
 * la vista filtrada), después los últimos pedidos y, al final, cómo viene la
 * tienda (números del período, barras de ventas, más vendidos).
 */
export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const sp = await searchParams;
  const period = parsePeriod(typeof sp.periodo === "string" ? sp.periodo : undefined);

  const [expired, store, onboarding] = await Promise.all([sweepExpiredOrders(supabase), getStoreInfo(supabase), getOnboardingStatus(ctx)]);
  const d = await getDashboard(supabase, period, store);
  const money = (v: number) => formatMoney(v, { currency: store.currency });
  const url = storeUrl(ctx.store);

  const onboardingOpen = !onboarding.dismissed && onboarding.completed < onboarding.steps.length;
  const sharedDone = onboarding.steps.find((s) => s.id === "shared")?.done ?? true;

  const todo: TodoItem[] = [
    {
      key: "confirm",
      count: d.actionCounts.toConfirm,
      label: "Pedidos por confirmar",
      short: "por confirmar",
      hint: "Confirmalos para que el cliente sepa que los viste.",
      href: "/admin/pedidos?tab=pendientes",
    },
    {
      key: "ship",
      count: d.actionCounts.toShip,
      label: "Para preparar y despachar",
      short: "para despachar",
      hint: "Confirmados que todavía no salieron.",
      href: "/admin/pedidos?tab=preparar",
    },
    {
      key: "unpaid",
      count: d.unpaid.count,
      label: "Pagos sin acreditar",
      short: "sin pagar",
      hint: `${money(d.unpaid.amount)} por cobrar.`,
      href: "/admin/pedidos?pago=impago",
    },
    {
      key: "expiring",
      count: d.expiring.length,
      label: "Reservas que vencen pronto",
      short: "reservas por vencer",
      hint: "Sin pago, se cancelan solas y el stock vuelve.",
      href: "#por-vencer",
    },
    {
      key: "withdrawals",
      count: d.withdrawals.total,
      label: "Arrepentimientos nuevos",
      short: "arrepentimientos",
      hint: "Solicitudes del botón de arrepentimiento.",
      href: "/admin/pedidos/arrepentimientos",
    },
    {
      key: "stock",
      count: d.lowStock.total,
      label: "Stock bajo",
      short: "con stock bajo",
      hint: "Variantes en o por debajo de su umbral.",
      href: "/admin/inventario?estado=bajo",
    },
  ].filter((t) => t.count > 0);

  // Dato útil en una línea (DESIGN §7.4): lo primero que hay que resolver.
  const summary = todo.length
    ? `Para hoy: ${todo
        .slice(0, 3)
        .map((t) => `${formatNumber(t.count)} ${t.short}`)
        .join(" · ")}`
    : d.totalOrders
      ? "Estás al día: no hay pedidos ni avisos esperando."
      : "Todavía no entró ningún pedido.";

  const header = (
    <PageHeader
      title={ctx.store.name}
      description={summary}
      actions={
        <>
          <NotificationsToggle />
          <CopyStoreLinkButton url={url} markShared={!sharedDone} />
        </>
      }
    />
  );

  const onboardingCard = onboardingOpen ? <OnboardingChecklist ctx={ctx} status={onboarding} /> : null;

  // ---------- Sin pedidos todavía: qué hacer primero ----------
  if (!d.totalOrders) {
    return (
      <>
        <ExpireSweep expired={expired} />
        {header}
        <div className="space-y-4">
          {onboardingCard}
          {/* Con el checklist abierto, su paso siguiente es la acción principal: esto queda secundario. */}
          <EmptyState
            className="px-4 py-5"
            title="Todavía no hay pedidos"
            description="Cuando alguien compre en tu tienda lo vas a ver acá. Si vendés por otro lado, cargalo como pedido manual."
            actions={
              <ButtonLink href="/admin/pedidos/nuevo" variant={onboardingOpen ? "secondary" : "primary"}>
                Crear pedido manual
              </ButtonLink>
            }
          />
          {todo.length ? <TodoCard items={todo} /> : null}
          {d.lowStock.rows.length || d.withdrawals.rows.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {d.lowStock.rows.length ? <LowStockCard d={d} /> : null}
              {d.withdrawals.rows.length ? <WithdrawalsCard d={d} /> : null}
            </div>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <ExpireSweep expired={expired} />
      {header}

      <div className="space-y-4">
        {onboardingCard}

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-8">
            {todo.length ? <TodoCard items={todo} /> : null}
            <RecentOrdersCard d={d} timeZone={store.timezone} />
            {d.expiring.length ? (
              <Card id="por-vencer" className="scroll-mt-20">
                <CardHeader title="Reservas que vencen pronto" description="Pedidos sin pago: si vencen, se cancelan solos y el stock vuelve." />
                <ul className="divide-y divide-adm-border">
                  {d.expiring.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-[120ms] hover:bg-adm-row-hover"
                      >
                        <span className="tnum w-14 shrink-0 font-medium">#{o.number}</span>
                        <span className="min-w-0 flex-1 truncate">{o.customer.name}</span>
                        <ExpiryText expiresAt={o.expiresAt} timeZone={store.timezone} />
                        <span className="tnum hidden w-24 text-right sm:block">{formatMoney(o.total, { currency: o.currency })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
          <div className="min-w-0 space-y-4 lg:col-span-4">
            {d.withdrawals.rows.length ? <WithdrawalsCard d={d} /> : null}
            <LowStockCard d={d} />
          </div>
        </div>

        <section aria-labelledby="como-viene" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-adm-border">
            <h2 id="como-viene" className="pb-2.5 text-base font-semibold">
              Cómo viene la tienda
            </h2>
            <TabsNav
              label="Período"
              className="border-b-0"
              items={PERIODS.map((p) => ({
                href: p === "7d" ? "/admin" : `/admin?periodo=${p}`,
                label: PERIOD_LABELS[p],
                active: p === period,
              }))}
            />
          </div>

          <StatStrip>
            <Stat
              label={SALES_LABEL[period]}
              value={money(d.sales.value)}
              delta={d.sales.comparison.text}
              trend={d.sales.comparison.percent === null ? undefined : d.sales.comparison.direction}
            />
            <Stat
              label="Pedidos"
              value={formatNumber(d.orders.value)}
              delta={d.orders.comparison.text}
              trend={d.orders.comparison.percent === null ? undefined : d.orders.comparison.direction}
              href="/admin/pedidos"
            />
            <Stat
              label="Ticket promedio"
              value={money(d.ticket.value)}
              delta={d.ticket.comparison.text}
              trend={d.ticket.comparison.percent === null ? undefined : d.ticket.comparison.direction}
            />
            <Stat
              label="Por cobrar"
              value={money(d.unpaid.amount)}
              delta={
                d.unpaid.count
                  ? `${formatNumber(d.unpaid.count)} ${d.unpaid.count === 1 ? "pedido pendiente" : "pedidos pendientes"} de pago`
                  : "Todo cobrado"
              }
              alert={d.unpaid.count > 0}
              href="/admin/pedidos?pago=impago"
            />
          </StatStrip>

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="min-w-0 lg:col-span-8">
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
            <Card className="min-w-0 lg:col-span-4">
              <CardHeader title="Más vendidos" description={PERIOD_LABELS[period]} />
              {d.topProducts.length ? (
                <ol className="divide-y divide-adm-border">
                  {d.topProducts.map((p, i) => (
                    <li key={`${p.productId ?? p.name}-${i}`} className="flex min-h-10 items-center gap-3 px-4 py-2 text-[13px]">
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
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * "Para hacer": sólo lo que tiene algo pendiente, cada fila lleva a la vista
 * ya filtrada (un toque desde el inicio, BRAND §11). Si no hay nada, no se
 * muestra: el encabezado ya dice "Estás al día".
 */
function TodoCard({ items }: { items: TodoItem[] }) {
  return (
    <Card aria-labelledby="para-hacer">
      <CardHeader title={<span id="para-hacer">Para hacer</span>} />
      <ul className="divide-y divide-adm-border">
        {items.map((t) => (
          <li key={t.key} className="min-w-0">
            <Link
              href={t.href}
              className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-[120ms] hover:bg-adm-row-hover"
            >
              <span className="tnum min-w-8 text-[22px] leading-7 font-semibold text-adm-fg">{formatNumber(t.count)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-adm-fg">{t.label}</span>
                <span className="block text-[13px] text-adm-fg-muted">{t.hint}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-adm-fg-muted transition-transform duration-[120ms] group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RecentOrdersCard({ d, timeZone }: { d: DashboardData; timeZone: string }) {
  return (
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
          <li key={o.id}>
            <Link
              href={`/admin/pedidos/${o.id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 text-[13px] transition-colors duration-[120ms] hover:bg-adm-row-hover sm:grid-cols-[4rem_minmax(0,1fr)_auto_6.5rem] sm:py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2 sm:contents">
                <span className={cn("tnum inline-flex items-center gap-1.5", o.seenAt ? "font-medium" : "font-semibold")}>
                  {o.seenAt ? null : <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-adm-accent-2" />}#{o.number}
                  {o.seenAt ? null : <span className="sr-only"> (nuevo)</span>}
                </span>
                <span className="min-w-0 truncate">
                  {o.customer.name}
                  <RelativeTime value={o.createdAt} timeZone={timeZone} className="ml-2 text-xs text-adm-fg-muted" />
                </span>
              </span>
              <span className="tnum text-right font-medium sm:order-last">{formatMoney(o.total, { currency: o.currency })}</span>
              <span className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1">
                <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                <PaymentStatusBadge status={o.paymentStatus} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LowStockCard({ d }: { d: DashboardData }) {
  return (
    <Card>
      <CardHeader
        title="Stock bajo"
        description={d.lowStock.total ? `${formatNumber(d.lowStock.total)} ${d.lowStock.total === 1 ? "variante" : "variantes"} en o bajo el umbral` : undefined}
        actions={
          <ButtonLink href={d.lowStock.total ? "/admin/inventario?estado=bajo" : "/admin/inventario"} size="sm" variant="ghost">
            Inventario
          </ButtonLink>
        }
      />
      {d.lowStock.rows.length ? (
        <ul className="divide-y divide-adm-border">
          {d.lowStock.rows.map((v) => (
            <li key={v.variant_id ?? v.sku ?? v.product_name} className="flex min-h-11 items-center gap-3 px-4 py-2 text-[13px]">
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
    </Card>
  );
}
