import { Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DueChip, Swatch } from "@/components/admin/print3d/production/bits";
import { SeedDefaultsButton } from "@/components/admin/print3d/config/SeedDefaultsButton";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, Stat, StatStrip } from "@/components/ui/display";
import { getOverview, LOW_STOCK_GRAMS } from "@/lib/admin/print3d-production";
import {
  dueState,
  failureReasonLabel,
  formatGrams,
  formatHoursShort,
  formatMinutes,
  remainingMinutes,
} from "@/lib/admin/print3d-production-utils";
import { requireAdmin } from "@/lib/auth";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/money";
import { hasModule } from "@/lib/modules/registry";

export const metadata: Metadata = { title: "Taller 3D" };

/** Resumen del taller (TALLER-3D §6): qué se imprime, qué vence, qué falta y cuánto queda. */
export default async function Taller3dPage() {
  const ctx = await requireAdmin();
  if (!hasModule(ctx, "print3d")) return null;

  const now = new Date();
  const o = await getOverview(ctx.supabase, ctx.store.id, now);
  const { settings } = o.workshop;
  const needsSetup = o.setupMissing.printers || o.setupMissing.materials || o.setupMissing.qualities;

  const printingNow = o.loads.filter((l) => l.current).length;
  const activeLoads = o.loads.filter((l) => l.printer.status === "active");
  const overdue = o.dueToday.filter((j) => dueState(j.due_date, o.today, j.status) === "overdue").length;
  const summary = [
    printingNow ? `${printingNow} ${printingNow === 1 ? "impresora imprimiendo" : "impresoras imprimiendo"}` : "Ninguna impresora imprimiendo",
    o.unassigned.length ? `${o.unassigned.length} sin asignar` : null,
    o.ordersToProduce ? `${o.ordersToProduce} ${o.ordersToProduce === 1 ? "pedido por producir" : "pedidos por producir"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title="Resumen del taller"
        description={summary}
        section="store"
        icon={<Printer />}
        actions={
          <>
            <ButtonLink href="/admin/taller-3d/cotizaciones?estado=pending_review">Cotizaciones</ButtonLink>
            <ButtonLink href="/admin/taller-3d/cola" variant="primary">
              Abrir la cola
            </ButtonLink>
          </>
        }
      />

      {needsSetup ? (
        <div className="mb-5 rounded-adm border border-adm-border bg-adm-accent-soft px-5 py-4">
          <p className="text-base font-semibold text-adm-fg">Arrancá cargando tu taller</p>
          <p className="mt-1 max-w-prose text-[13px] text-adm-fg-muted">
            Falta{" "}
            {[o.setupMissing.printers ? "alguna impresora" : null, o.setupMissing.materials ? "materiales" : null, o.setupMissing.qualities ? "calidades" : null]
              .filter(Boolean)
              .join(", ")}
            . Podés cargar valores de ejemplo (3 calidades, PLA, PETG y TPU con colores comunes y una A1) y después ajustarlos a tus
            precios y bobinas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SeedDefaultsButton />
            <ButtonLink href="/admin/taller-3d/impresoras">Cargar a mano</ButtonLink>
          </div>
        </div>
      ) : null}

      <StatStrip className="mb-5">
        <Stat
          label="Imprimiendo ahora"
          value={`${printingNow} de ${activeLoads.length}`}
          delta={activeLoads.length - printingNow > 0 ? `${activeLoads.length - printingNow} paradas` : "Todas trabajando"}
          alert={activeLoads.length - printingNow > 0 && o.jobs.some((j) => j.status === "queued")}
          href="/admin/taller-3d/cola"
        />
        <Stat
          label="Para entregar hoy"
          value={o.dueToday.length}
          delta={overdue ? `${overdue} ${overdue === 1 ? "vencido" : "vencidos"}` : "Nada vencido"}
          trend={overdue ? "down" : undefined}
          href="/admin/taller-3d/cola"
        />
        <Stat
          label="Cotizaciones por revisar"
          value={o.pendingQuotesCount}
          delta={o.pendingQuotes[0] ? `La más vieja ${formatRelative(o.pendingQuotes[0].created_at)}` : "Al día"}
          alert={o.pendingQuotesCount > 0}
          href="/admin/taller-3d/cotizaciones?estado=pending_review"
        />
        <Stat
          label="Margen 30 días"
          value={o.month.revenue > 0 ? formatMoney(o.month.margin.amount) : "—"}
          delta={
            o.month.revenue > 0 && o.month.margin.pct !== null
              ? `${formatPercent(Math.round(o.month.margin.pct * 100))} sobre ${formatMoney(o.month.revenue)}`
              : "Sin trabajos terminados"
          }
          trend={o.month.revenue > 0 ? (o.month.margin.amount >= 0 ? "up" : "down") : undefined}
        />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Ocupación de las impresoras"
              description={`Horas cargadas contra ${settings.daily_print_hours.toLocaleString("es-AR")} h útiles por día`}
              actions={
                <ButtonLink href="/admin/taller-3d/impresoras" size="sm" variant="ghost">
                  Impresoras
                </ButtonLink>
              }
            />
            {o.loads.length ? (
              <ul className="divide-y divide-adm-border">
                {o.loads.map((l) => {
                  const ratio = l.backlogMinutes / 60 / Math.max(1, settings.daily_print_hours);
                  return (
                    <li key={l.printer.id} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: l.printer.color }} />
                        <span className="text-sm font-semibold">{l.printer.name}</span>
                        {l.printer.status === "maintenance" ? <span className="text-xs text-adm-warning">en mantenimiento</span> : null}
                        <span className="tnum ml-auto text-[13px] text-adm-fg-muted">
                          <span className="font-medium text-adm-fg">{formatHoursShort(l.backlogMinutes)}</span>
                          {ratio > 1 ? ` · ${ratio.toLocaleString("es-AR", { maximumFractionDigits: 1 })} días` : ""}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-adm-surface-2" aria-hidden>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, ratio * 100)}%`, background: ratio > 1 ? "var(--adm-warning)" : l.printer.color }}
                        />
                      </div>
                      <p className="mt-1 truncate text-xs text-adm-fg-muted">
                        {l.current
                          ? `Imprimiendo «${l.current.title}» · faltan ${formatMinutes(remainingMinutes(l.current, now))}`
                          : l.queued
                            ? `Parada con ${l.queued} en cola`
                            : "Libre"}
                        {l.current && l.queued ? ` · ${l.queued} en cola` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <CardBody className="text-[13px] text-adm-fg-muted">Todavía no cargaste impresoras.</CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Para entregar hoy"
              description="Trabajos con fecha comprometida hoy o vencida"
              actions={
                <ButtonLink href="/admin/taller-3d/cola" size="sm" variant="ghost">
                  Ver la cola
                </ButtonLink>
              }
            />
            {o.dueToday.length ? (
              <ul className="divide-y divide-adm-border">
                {o.dueToday.slice(0, 12).map((j) => {
                  const printer = o.workshop.printers.find((p) => p.id === j.printer_id);
                  const color = o.workshop.colors.find((c) => c.id === j.color_id);
                  return (
                    <li key={j.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                      <Swatch hex={color?.hex} size={12} />
                      <span className="min-w-0 flex-1 truncate font-medium">{j.title}</span>
                      {j.order_number && j.order_id ? (
                        <Link href={`/admin/pedidos/${j.order_id}`} className="tnum shrink-0 text-adm-link hover:underline">
                          #{j.order_number}
                        </Link>
                      ) : null}
                      <span className="hidden shrink-0 text-adm-fg-muted sm:inline">{printer ? printer.name : "Sin asignar"}</span>
                      <DueChip due={j.due_date} today={o.today} status={j.status} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <CardBody className="text-[13px] text-adm-fg-muted">Nada vence hoy. {o.jobs.length ? `Hay ${o.jobs.length} trabajos en la cola.` : ""}</CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Margen de los últimos 30 días" description={`${o.month.jobs} trabajos cerrados (terminados y fallados)`} />
            <CardBody>
              <dl className="tnum grid max-w-md gap-1.5 text-[13px]">
                <Row label="Vendido (piezas terminadas)" value={formatMoney(o.month.revenue)} strong />
                <Row label="Filamento" value={`− ${formatMoney(o.month.cost.material)}`} />
                <Row label="Luz" value={`− ${formatMoney(o.month.cost.energy)}`} />
                <Row label="Desgaste de las máquinas" value={`− ${formatMoney(o.month.cost.amortization)}`} />
                <Row label="Post-proceso" value={`− ${formatMoney(o.month.cost.labor)}`} />
                <Row label="Fallas (filamento tirado)" value={`− ${formatMoney(o.month.cost.waste)}`} />
                <div className="mt-1 flex justify-between gap-4 border-t border-adm-border pt-2 text-sm font-semibold">
                  <dt>Margen</dt>
                  <dd className={cn(o.month.margin.amount < 0 && "text-adm-danger")}>
                    {formatMoney(o.month.margin.amount)}
                    {o.month.margin.pct !== null ? ` (${formatPercent(Math.round(o.month.margin.pct * 100))})` : ""}
                  </dd>
                </div>
              </dl>
              {o.month.cost.incomplete ? (
                <p className="mt-3 text-xs text-adm-fg-muted">
                  Faltan costos de bobinas o datos de alguna impresora: el margen real es menor. Cargalos en{" "}
                  <Link href="/admin/taller-3d/filamento" className="text-adm-link hover:underline">
                    Filamento
                  </Link>
                  .
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Cotizaciones por revisar"
              actions={
                <ButtonLink href="/admin/taller-3d/cotizaciones?estado=pending_review" size="sm" variant="ghost">
                  Ver todas
                </ButtonLink>
              }
            />
            {o.pendingQuotes.length ? (
              <ul className="divide-y divide-adm-border">
                {o.pendingQuotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/admin/taller-3d/cotizaciones/${q.id}`} className="flex items-center gap-2 px-4 py-2.5 text-[13px] hover:bg-adm-row-hover">
                      <span className="min-w-0 flex-1 truncate font-medium">{q.contactName ?? "Sin nombre"}</span>
                      <span className="tnum shrink-0 text-adm-fg-muted">
                        {q.items} {q.items === 1 ? "pieza" : "piezas"} · {formatRelative(q.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="text-[13px] text-adm-fg-muted">No hay cotizaciones esperando. Las que no se pueden precisar solas caen acá.</CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Filamento corto"
              description={`Colores con menos de ${LOW_STOCK_GRAMS} g sumando bobinas`}
              actions={
                <ButtonLink href="/admin/taller-3d/filamento" size="sm" variant="ghost">
                  Filamento
                </ButtonLink>
              }
            />
            {o.lowStock.length ? (
              <ul className="divide-y divide-adm-border">
                {o.lowStock.slice(0, 8).map((s) => (
                  <li key={s.color.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                    <Swatch hex={s.color.hex} size={14} />
                    <span className="min-w-0 flex-1 truncate">
                      {s.material?.type ?? ""} {s.color.name}
                    </span>
                    <span className={cn("tnum shrink-0 font-medium", s.grams <= 0 ? "text-adm-danger" : "text-adm-warning")}>
                      {s.grams <= 0 ? "Sin bobina" : formatGrams(s.grams)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="text-[13px] text-adm-fg-muted">Todos los colores activos tienen filamento.</CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title="Fallas de la semana" />
            <CardBody className="text-[13px]">
              {o.week.done + o.week.failed ? (
                <>
                  <p className="tnum text-[28px] leading-8 font-semibold">
                    {o.week.failRate !== null ? formatPercent(Math.round(o.week.failRate * 100)) : "—"}
                  </p>
                  <p className="tnum text-adm-fg-muted">
                    {o.week.failed} {o.week.failed === 1 ? "falló" : "fallaron"} de {o.week.done + o.week.failed} ·{" "}
                    {formatGrams(o.week.wastedGrams)} tirados
                  </p>
                  {o.week.topReason ? <p className="mt-2">Lo que más pasó: {failureReasonLabel(o.week.topReason)?.toLowerCase()}.</p> : null}
                </>
              ) : (
                <p className="text-adm-fg-muted">Esta semana no se cerró ningún trabajo.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong ? "font-medium" : "text-adm-fg-muted")}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
