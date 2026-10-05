import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { NotificationsToggle } from "@/components/admin/dashboard/NotificationsToggle";
import { CopyStoreLinkButton } from "@/components/admin/dashboard/OnboardingActions";
import { OnboardingChecklist } from "@/components/admin/dashboard/OnboardingChecklist";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { StoreCard } from "@/components/admin/dashboard/StoreCard";
import { AllClear, TodoBoard, type TodoItem } from "@/components/admin/dashboard/TodoBoard";
import { WeekInsightsCard } from "@/components/admin/dashboard/WeekInsights";
import { WorkQueue } from "@/components/admin/dashboard/WorkQueue";
import { ExpireSweep } from "@/components/admin/orders/ExpireSweep";
import { ExpiryText, OrderStatusBadge, PaymentStatusBadge, RelativeTime } from "@/components/admin/orders/OrderBadges";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth";
import { getDashboard, getWorkQueue } from "@/lib/admin/dashboard";
import { getWeekInsights } from "@/lib/admin/insights";
import { parsePeriod, PERIOD_LABELS, PERIODS, type PeriodKey } from "@/lib/admin/dashboard-utils";
import { getStoreInfo, sweepExpiredOrders } from "@/lib/admin/orders";
import { todoHeadline } from "@/lib/admin/work-queue";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";
import { getOnboardingStatus } from "@/lib/onboarding";
import { storeDisplayHost, storeHref, storeUrl } from "@/lib/tenant/urls";
import { parseTheme } from "@/lib/theme";

import "@/components/admin/dashboard/dashboard.css";

export const metadata: Metadata = { title: "Inicio" };

const SALES_LABEL = { hoy: "Ventas de hoy", "7d": "Ventas 7 días", "30d": "Ventas 30 días" } as const;

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** "Buen día" / "Buenas tardes" / "Buenas noches" y la fecha, en la zona de la tienda. */
function greeting(timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  const hello = hour >= 6 && hour < 13 ? "Buen día" : hour >= 13 && hour < 20 ? "Buenas tardes" : "Buenas noches";
  const date = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone }).format(now);
  return { hello, date: date.replace(",", "") };
}

/**
 * Inicio del panel (DESIGN §7.8, BRAND §1 y §11). Contesta en este orden:
 * ¿qué tengo que hacer hoy? (cabecera con "Tenés N cosas para resolver" +
 * "Para hacer" con la más urgente en burbuja), resolverlo ahí mismo ("Resolver
 * desde acá": los pedidos con su siguiente paso en un toque), ¿mi tienda está
 * online? (miniatura real con el link), ¿qué falta para dejarla lista?
 * (primeros pasos en arco), los últimos pedidos y, al final, cómo viene
 * (métricas, curva de ventas, más vendidos).
 * En el celular lo urgente queda arriba y todo es una columna.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const ctx = await requireAdmin();
  const { supabase } = ctx;
  const sp = await searchParams;
  const period = parsePeriod(typeof sp.periodo === "string" ? sp.periodo : undefined);

  const [expired, store, onboarding, settings, productNames] = await Promise.all([
    sweepExpiredOrders(supabase),
    getStoreInfo(supabase),
    getOnboardingStatus(ctx),
    supabase.from("store_settings").select("theme, tagline").eq("store_id", ctx.store.id).maybeSingle(),
    supabase.from("products").select("name").eq("store_id", ctx.store.id).eq("status", "active").order("updated_at", { ascending: false }).limit(6),
  ]);
  const [d, queue, week] = await Promise.all([
    getDashboard(supabase, period, store),
    getWorkQueue(supabase, store, ctx.store),
    getWeekInsights(supabase, store),
  ]);
  const money = (v: number) => formatMoney(v, { currency: store.currency });
  const url = storeUrl(ctx.store);

  const onboardingOpen = !onboarding.dismissed && onboarding.completed < onboarding.steps.length;
  const sharedDone = onboarding.steps.find((s) => s.id === "shared")?.done ?? true;

  const todo: TodoItem[] = (
    [
      {
        key: "confirm",
        count: d.actionCounts.toConfirm,
        label: d.actionCounts.toConfirm === 1 ? "Pedido por confirmar" : "Pedidos por confirmar",
        short: "por confirmar",
        hint: "Confirmalos para que el cliente sepa que los viste.",
        href: "/admin/pedidos?tab=pendientes",
        go: "Confirmar pedidos",
      },
      {
        key: "ship",
        count: d.actionCounts.toShip,
        label: "Para preparar y despachar",
        short: "para despachar",
        hint: "Confirmados que todavía no salieron.",
        href: "/admin/pedidos?tab=preparar",
        go: "Ver para preparar",
      },
      {
        key: "unpaid",
        count: d.unpaid.count,
        label: "Pagos sin acreditar",
        short: "sin pagar",
        hint: `${money(d.unpaid.amount)} por cobrar.`,
        href: "/admin/pedidos?pago=impago",
        go: "Ver cobros",
      },
      {
        key: "expiring",
        count: d.expiring.length,
        label: "Reservas por vencer",
        short: "reservas por vencer",
        hint: "Sin pago, se cancelan solas y el stock vuelve.",
        href: "#por-vencer",
        go: "Ver reservas",
      },
      {
        key: "withdrawals",
        count: d.withdrawals.total,
        label: "Arrepentimientos nuevos",
        short: "arrepentimientos",
        hint: "Pedidos de baja del botón de arrepentimiento.",
        href: "/admin/pedidos/arrepentimientos",
        go: "Ver bandeja",
      },
      {
        key: "stock",
        count: d.lowStock.total,
        label: "Con stock bajo",
        short: "con stock bajo",
        hint: "Variantes en o por debajo de su umbral.",
        href: "/admin/inventario?estado=bajo",
        go: "Ver inventario",
      },
    ] satisfies TodoItem[]
  ).filter((t) => t.count > 0);

  // Cosas distintas, no la suma de los contadores (un pendiente impago está
  // en "por confirmar", "sin pagar" y "por vencer" a la vez): los pedidos
  // accionables una sola vez, más arrepentimientos y variantes con stock bajo.
  const headline = todoHeadline(queue.total + d.withdrawals.total + d.lowStock.total, d.totalOrders > 0);
  // Lo que ya está en "Resolver desde acá" no se repite en "Últimos pedidos".
  const queued = new Set(queue.items.map((o) => o.id));
  const recent = queue.items.length ? d.recent.filter((o) => !queued.has(o.id)).slice(0, 5) : d.recent;

  const { hello, date } = greeting(store.timezone);
  const theme = parseTheme(settings.data?.theme ?? {});

  const storeCard = (
    <StoreCard
      theme={theme}
      name={ctx.store.name}
      tagline={settings.data?.tagline ?? null}
      products={(productNames.data ?? []).map((p) => p.name)}
      url={url}
      host={storeDisplayHost(ctx.store)}
      href={storeHref(ctx.store)}
      markShared={!sharedDone}
      online={ctx.store.status === "active"}
    />
  );

  return (
    <>
      <ExpireSweep expired={expired} />

      {/* ---------- Cabecera: saludo, resumen del día y acciones ---------- */}
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-[13px] text-adm-fg-muted first-letter:uppercase">
            {hello} · <span suppressHydrationWarning>{date}</span>
          </p>
          <h1 className="eco-display mt-1.5 text-[28px] leading-[1.05] text-adm-fg sm:text-[34px]">{ctx.store.name}</h1>
          {headline ? (
            <p className="mt-2 flex items-center gap-2 text-[17px] leading-6 font-semibold text-adm-fg">
              {todo.length ? null : <span aria-hidden className="size-2 shrink-0 rounded-full bg-adm-success" />}
              {headline}
            </p>
          ) : null}
          {todo.length ? (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="sr-only">Para hoy: </span>
              {todo.slice(0, 3).map((t, i) => (
                <Link
                  key={t.key}
                  href={t.href}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium transition-colors duration-[140ms] ease-eco-out pointer-coarse:h-10",
                    i === 0 ? "bg-adm-accent-2-soft text-adm-fg hover:bg-eco-durazno" : "bg-adm-surface-2 text-adm-fg hover:bg-adm-border",
                  )}
                >
                  <span className="eco-num text-[13px]">{formatNumber(t.count)}</span>
                  {t.short}
                </Link>
              ))}
            </p>
          ) : !headline ? (
            <p className="mt-2.5 text-[13px]">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-adm-surface-2 px-2.5 font-medium text-adm-fg">
                <span aria-hidden className="size-1.5 rounded-full bg-adm-success" />
                Todavía no entró ningún pedido
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationsToggle />
          <CopyStoreLinkButton url={url} markShared={!sharedDone} />
        </div>
      </header>

      <div className="space-y-6">
        {/* ---------- Hoy: lo urgente, la tienda, los pedidos ----------
            Una sola grilla: en desktop la columna derecha (tienda y avisos)
            ocupa todas las filas y la izquierda fluye sin huecos; en el
            celular el orden es el del DOM (lo urgente primero). */}
        <div className="grid items-start gap-4 lg:grid-cols-12 lg:grid-rows-[repeat(5,auto)_1fr] lg:gap-x-5 lg:gap-y-4">
          <div className="min-w-0 lg:col-span-8 lg:col-start-1">
            {todo.length ? <TodoBoard items={todo} /> : <AllClear hasOrders={d.totalOrders > 0} />}
          </div>
          {queue.items.length ? (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1">
              <WorkQueue items={queue.items} total={queue.total} timeZone={store.timezone} />
            </div>
          ) : null}
          {onboardingOpen ? (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1">
              <OnboardingChecklist ctx={ctx} status={onboarding} />
            </div>
          ) : null}
          <aside aria-label="Tu tienda y avisos" className="min-w-0 space-y-4 lg:col-span-4 lg:col-start-9 lg:row-span-6 lg:row-start-1">
            {storeCard}
            {d.withdrawals.rows.length ? <WithdrawalsCard d={d} /> : null}
            {d.totalOrders || d.lowStock.rows.length ? <LowStockCard d={d} /> : null}
          </aside>
          {!d.totalOrders ? (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1">
              <NoOrdersYet secondary={onboardingOpen} />
            </div>
          ) : recent.length ? (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1">
              <RecentOrders orders={recent} filtered={recent.length !== d.recent.length} timeZone={store.timezone} />
            </div>
          ) : null}
          {d.expiring.length ? (
            <div className="min-w-0 lg:col-span-8 lg:col-start-1">
              <ExpiringCard d={d} timeZone={store.timezone} />
            </div>
          ) : null}
        </div>

        {/* ---------- Cómo viene la tienda ---------- */}
        {d.totalOrders ? (
          <section aria-labelledby="como-viene" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div>
                <h2 id="como-viene" className="eco-display text-[20px] leading-6 text-adm-fg">
                  Cómo viene la tienda
                </h2>
                <p className="mt-1 text-[13px] text-adm-fg-muted">Pedidos no cancelados, por fecha de creación.</p>
              </div>
              <PeriodPills period={period} />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label={SALES_LABEL[period]} value={money(d.sales.value)} comparison={d.sales.comparison} />
              <Metric label="Pedidos" value={formatNumber(d.orders.value)} comparison={d.orders.comparison} href="/admin/pedidos" />
              <Metric label="Ticket promedio" value={money(d.ticket.value)} comparison={d.ticket.comparison} />
              <Metric
                label="Por cobrar"
                value={money(d.unpaid.amount)}
                note={
                  d.unpaid.count
                    ? `${formatNumber(d.unpaid.count)} ${d.unpaid.count === 1 ? "pedido pendiente" : "pedidos pendientes"} de pago`
                    : "Todo cobrado"
                }
                alert={d.unpaid.count > 0}
                href="/admin/pedidos?pago=impago"
              />
            </div>

            {/* Qué pasó esta semana: el porqué de los números, sin IA (PRODUCT-THESIS §4.3). Siempre compara 7 días. */}
            <WeekInsightsCard data={week} currency={store.currency} />

            <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-5">
              <section aria-labelledby="ventas-title" className="min-w-0 rounded-adm-lg border border-adm-border bg-adm-surface p-4 shadow-adm-card sm:p-5 lg:col-span-8">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 id="ventas-title" className="text-[15px] font-semibold text-adm-fg">
                    {period === "hoy" ? "Ventas de hoy por hora" : `Ventas de los últimos ${period === "7d" ? "7" : "30"} días`}
                  </h3>
                  <p className="text-[13px] text-adm-fg-muted">
                    <span className="eco-num text-[17px] text-adm-fg">{money(d.sales.value)}</span> en {formatNumber(d.orders.value)}{" "}
                    {d.orders.value === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>
                <SalesChart
                  points={d.series}
                  currency={store.currency}
                  caption={`Ventas por ${period === "hoy" ? "hora" : "día"}: ${money(d.sales.value)} en total.`}
                  emptyHint={period === "30d" ? "Cuando entren pedidos vas a ver la curva acá." : "Probá con un período más largo."}
                />
              </section>
              <TopProducts d={d} period={period} money={money} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function NoOrdersYet({ secondary }: { secondary: boolean }) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-adm-lg border border-dashed border-adm-input-border/60 bg-adm-surface px-4 py-4 sm:px-5">
      <span aria-hidden className="eco-bubble inline-flex size-11 shrink-0 items-center justify-center bg-eco-durazno text-adm-fg [--eco-bubble-r:16px]">
        <PackageOpen className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-adm-fg">Todavía no hay pedidos</p>
        <p className="text-[13px] text-adm-fg-muted">Cuando alguien compre en tu tienda lo vas a ver acá. Si vendés por otro lado, cargalo a mano.</p>
      </div>
      <ButtonLink href="/admin/pedidos/nuevo" variant={secondary ? "secondary" : "primary"}>
        Crear pedido manual
      </ButtonLink>
    </section>
  );
}

function PeriodPills({ period }: { period: PeriodKey }) {
  return (
    <nav aria-label="Período" className="inline-flex rounded-full border border-adm-border bg-adm-surface p-1 shadow-adm-card">
      {PERIODS.map((p) => {
        const active = p === period;
        return (
          <Link
            key={p}
            href={p === "7d" ? "/admin" : `/admin?periodo=${p}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors duration-[140ms] ease-eco-out pointer-coarse:h-10",
              active ? "bg-adm-fg text-white" : "text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg",
            )}
          >
            {PERIOD_LABELS[p]}
          </Link>
        );
      })}
    </nav>
  );
}

function Metric({
  label,
  value,
  comparison,
  note,
  alert,
  href,
}: {
  label: string;
  value: string;
  comparison?: DashboardData["sales"]["comparison"];
  note?: string;
  alert?: boolean;
  href?: string;
}) {
  const hasDelta = comparison && comparison.percent !== null;
  const dir = hasDelta ? comparison.direction : "flat";
  const DeltaIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const body = (
    <>
      <span className="block text-xs font-medium text-adm-fg-muted">{label}</span>
      <span className="eco-num mt-2 block truncate text-[22px] leading-7 text-adm-fg sm:text-[28px] sm:leading-8">{value}</span>
      {comparison ? (
        <span
          className={cn(
            "mt-2 flex max-w-full items-start gap-1 text-xs",
            !hasDelta ? "text-adm-fg-muted" : dir === "up" ? "text-adm-success" : dir === "down" ? "text-adm-danger" : "text-adm-fg-muted",
          )}
        >
          <DeltaIcon aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={2} />
          <span className="tnum line-clamp-2">{comparison.text}</span>
        </span>
      ) : note ? (
        <span className={cn("mt-2 block text-xs", alert ? "font-medium text-adm-warning" : "text-adm-fg-muted")}>{note}</span>
      ) : null}
    </>
  );
  const cls = cn(
    "block min-w-0 rounded-adm-lg border border-adm-border bg-adm-surface p-3.5 shadow-adm-card sm:p-4",
    alert && "border-l-[3px] border-l-adm-warning",
  );
  return href ? (
    <Link href={href} className={cn(cls, "dsh-lift hover:border-adm-input-border")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ListCard({
  title,
  description,
  action,
  children,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card", className)}>
      <header className="flex items-start justify-between gap-4 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] leading-6 font-semibold text-adm-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-adm-fg-muted">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function SeeAll({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-adm-link hover:bg-adm-accent-soft pointer-coarse:h-10"
    >
      {children}
      <ArrowRight aria-hidden className="dsh-go size-3.5" />
    </Link>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

function RecentOrders({ orders, filtered, timeZone }: { orders: DashboardData["recent"]; filtered: boolean; timeZone: string }) {
  return (
    <ListCard
      title="Últimos pedidos"
      description={filtered ? "Sin los que tenés arriba para resolver." : undefined}
      action={<SeeAll href="/admin/pedidos">Ver todos</SeeAll>}
    >
      <ul className="divide-y divide-adm-border border-t border-adm-border">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/pedidos/${o.id}`}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 text-[13px] transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover sm:grid-cols-[2.25rem_minmax(0,1fr)_auto_7rem] sm:px-5 sm:py-2.5"
            >
              <span
                aria-hidden
                className={cn(
                  "relative row-span-2 inline-flex size-9 items-center justify-center rounded-full text-xs font-semibold sm:row-span-1",
                  o.seenAt ? "bg-adm-surface-2 text-adm-fg-muted" : "bg-adm-accent-2-soft text-adm-accent-2-ink",
                )}
              >
                {initials(o.customer.name)}
                {o.seenAt ? null : <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-adm-surface bg-eco-pomelo" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className={cn("tnum shrink-0", o.seenAt ? "font-medium" : "font-semibold")}>#{o.number}</span>
                  <span className="truncate text-adm-fg">{o.customer.name}</span>
                  {o.seenAt ? null : <span className="sr-only"> (nuevo)</span>}
                </span>
                <RelativeTime value={o.createdAt} timeZone={timeZone} className="block text-xs text-adm-fg-muted" />
              </span>
              <span className="tnum text-right font-semibold text-adm-fg sm:order-last">{formatMoney(o.total, { currency: o.currency })}</span>
              <span className="col-span-2 col-start-2 flex flex-wrap items-center gap-1.5 sm:col-span-1 sm:col-start-auto sm:justify-end">
                <OrderStatusBadge status={o.status} fulfillment={o.fulfillment} />
                <PaymentStatusBadge status={o.paymentStatus} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ListCard>
  );
}

function ExpiringCard({ d, timeZone }: { d: DashboardData; timeZone: string }) {
  return (
    <ListCard id="por-vencer" className="scroll-mt-20" title="Reservas por vencer" description="Pedidos sin pago: si vencen, se cancelan solos y el stock vuelve.">
      <ul className="divide-y divide-adm-border border-t border-adm-border">
        {d.expiring.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/pedidos/${o.id}`}
              className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover sm:px-5"
            >
              <span className="tnum w-14 shrink-0 font-medium">#{o.number}</span>
              <span className="min-w-0 flex-1 truncate">{o.customer.name}</span>
              <ExpiryText expiresAt={o.expiresAt} timeZone={timeZone} />
              <span className="tnum hidden w-24 text-right sm:block">{formatMoney(o.total, { currency: o.currency })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ListCard>
  );
}

function LowStockCard({ d }: { d: DashboardData }) {
  return (
    <ListCard
      title="Stock bajo"
      description={d.lowStock.total ? `${formatNumber(d.lowStock.total)} ${d.lowStock.total === 1 ? "variante" : "variantes"} en o bajo el umbral` : undefined}
      action={<SeeAll href={d.lowStock.total ? "/admin/inventario?estado=bajo" : "/admin/inventario"}>Inventario</SeeAll>}
    >
      {d.lowStock.rows.length ? (
        <ul className="divide-y divide-adm-border border-t border-adm-border">
          {d.lowStock.rows.map((v) => (
            <li key={v.variant_id ?? v.sku ?? v.product_name} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-[13px] sm:px-5">
              <div className="min-w-0 flex-1">
                {v.product_id ? (
                  <Link href={`/admin/productos/${v.product_id}`} className="block truncate font-medium text-adm-fg hover:text-adm-link hover:underline">
                    {v.product_name}
                  </Link>
                ) : (
                  <span className="block truncate font-medium">{v.product_name}</span>
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
        <p className="flex items-center gap-2 border-t border-adm-border px-4 py-3 text-[13px] text-adm-fg-muted sm:px-5">
          <span aria-hidden className="size-1.5 rounded-full bg-adm-success" />
          Ninguna variante está por debajo del umbral.
        </p>
      )}
    </ListCard>
  );
}

function WithdrawalsCard({ d }: { d: DashboardData }) {
  return (
    <ListCard title="Arrepentimientos nuevos" action={<SeeAll href="/admin/pedidos/arrepentimientos">Ver bandeja</SeeAll>}>
      <ul className="divide-y divide-adm-border border-t border-adm-border">
        {d.withdrawals.rows.map((w) => (
          <li key={w.id} className="px-4 py-2.5 text-[13px] sm:px-5">
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
    </ListCard>
  );
}

function TopProducts({ d, period, money }: { d: DashboardData; period: PeriodKey; money: (v: number) => string }) {
  const top = Math.max(1, ...d.topProducts.map((p) => p.qty));
  return (
    <ListCard title="Más vendidos" description={PERIOD_LABELS[period]} className="lg:col-span-4">
      {d.topProducts.length ? (
        <ol className="space-y-1 border-t border-adm-border px-2 py-2 sm:px-3">
          {d.topProducts.map((p, i) => {
            const row = (
              <>
                <span className="tnum w-4 shrink-0 text-center text-xs font-semibold text-adm-fg-muted">{i + 1}</span>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura de URL externa/bucket, sin optimizar
                  <img src={p.imageUrl} alt="" width={36} height={36} loading="lazy" className="size-9 shrink-0 rounded-[8px] border border-adm-border bg-adm-surface-2 object-cover" />
                ) : (
                  <span aria-hidden className="size-9 shrink-0 rounded-[8px] border border-adm-border bg-adm-surface-2" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-adm-fg">{p.name}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-adm-surface-2" aria-hidden>
                    <span className="block h-full rounded-full bg-eco-pomelo" style={{ width: `${Math.max(6, (p.qty / top) * 100)}%` }} />
                  </span>
                </span>
                <span className="tnum shrink-0 text-right text-xs" title={money(p.revenue)}>
                  <span className="block font-semibold text-adm-fg">{formatNumber(p.qty)} u.</span>
                  <span className="block text-adm-fg-muted">{money(p.revenue)}</span>
                </span>
              </>
            );
            return (
              <li key={`${p.productId ?? p.name}-${i}`}>
                {p.productId ? (
                  <Link href={`/admin/productos/${p.productId}`} className="flex min-h-12 items-center gap-3 rounded-adm px-2 py-1.5 transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover">
                    {row}
                  </Link>
                ) : (
                  <div className="flex min-h-12 items-center gap-3 px-2 py-1.5">{row}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="border-t border-adm-border px-4 py-4 text-[13px] text-adm-fg-muted sm:px-5">Sin ventas en el período.</p>
      )}
    </ListCard>
  );
}
