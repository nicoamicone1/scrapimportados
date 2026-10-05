import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, PackageMinus, Tag, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { EMPTY_REASON, type InsightDriver, type InsightDriverKind, type WeekInsights } from "@/lib/admin/insights-utils";
import { cn } from "@/lib/cn";

/**
 * "Qué pasó esta semana" (PRODUCT-THESIS §4.3): titular de la comparación
 * semanal y hasta 4 motivos, cada uno con link a donde se resuelve. Los textos
 * llegan armados y con la plata ya formateada en `currency` (ver
 * `explainWeek`). Con `tone: "empty"` la tarjeta se muestra igual, con el
 * motivo, para que se entienda qué va a aparecer acá.
 */

const DRIVER_ICON: Record<InsightDriverKind, { icon: LucideIcon; className: string; label: string }> = {
  product_down: { icon: TrendingDown, className: "bg-adm-danger-soft text-adm-danger", label: "Bajó" },
  no_sales_product: { icon: TrendingDown, className: "bg-adm-danger-soft text-adm-danger", label: "Sin ventas" },
  product_up: { icon: TrendingUp, className: "bg-adm-surface-2 text-adm-success", label: "Subió" },
  price_change: { icon: Tag, className: "bg-adm-accent-soft text-adm-fg", label: "Precios" },
  stock_out: { icon: PackageMinus, className: "bg-adm-surface-2 text-adm-warning", label: "Sin stock" },
};

const TONE_ICON = {
  up: { icon: ArrowUpRight, className: "text-adm-success" },
  down: { icon: ArrowDownRight, className: "text-adm-danger" },
  flat: { icon: Minus, className: "text-adm-fg-muted" },
} as const;

export function WeekInsightsCard({ data, currency }: { data: WeekInsights; currency: string }) {
  const empty = data.tone === "empty";
  const tone = data.tone === "empty" ? null : TONE_ICON[data.tone];

  return (
    <section
      aria-labelledby="semana-title"
      data-currency={currency}
      className="min-w-0 overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card"
    >
      <header className="px-4 pt-4 pb-3 sm:px-5">
        <h2 id="semana-title" className="text-[15px] leading-6 font-semibold text-adm-fg">
          Qué pasó esta semana
        </h2>
        <p className="mt-0.5 text-[13px] text-adm-fg-muted">Últimos 7 días contra los 7 anteriores.</p>
      </header>

      <div className="px-4 pb-4 sm:px-5">
        <p className={cn("flex items-start gap-2 text-[17px] leading-6 font-semibold", empty ? "text-adm-fg-muted" : "text-adm-fg")}>
          {tone ? <tone.icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", tone.className)} strokeWidth={2} /> : null}
          <span className="tnum min-w-0">{data.headline}</span>
        </p>
        {data.detail ? <p className="tnum mt-1 text-[13px] text-adm-fg-muted">{data.detail}</p> : null}

        {empty ? (
          <div className="mt-3 rounded-adm border border-dashed border-adm-input-border/60 px-3 py-2.5 text-[13px] text-adm-fg-muted">
            <p>{data.emptyReason}</p>
            {data.emptyReason === EMPTY_REASON ? (
              <p className="mt-0.5">Con 3 pedidos en alguna de las dos semanas, acá vas a ver qué productos, precios o faltantes explican el cambio.</p>
            ) : null}
          </div>
        ) : data.drivers.length ? (
          <ul className="mt-3 divide-y divide-adm-border border-t border-adm-border">
            {data.drivers.map((d, i) => (
              <li key={`${d.kind}-${i}`}>
                <DriverRow driver={d} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-adm-fg-muted">Ningún producto, precio o faltante explica el cambio por sí solo.</p>
        )}
      </div>
    </section>
  );
}

function DriverRow({ driver }: { driver: InsightDriver }) {
  const meta = DRIVER_ICON[driver.kind];
  const Icon = meta.icon;
  const body = (
    <>
      <span aria-hidden className={cn("mt-px inline-flex size-7 shrink-0 items-center justify-center rounded-full", meta.className)}>
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <span className="sr-only">{meta.label}: </span>
      <span className="tnum min-w-0 flex-1 text-[13px] leading-5 text-adm-fg">{driver.text}</span>
      {driver.href ? <ArrowRight aria-hidden className="dsh-go mt-0.5 size-3.5 shrink-0 text-adm-link" /> : null}
    </>
  );
  const cls = "flex min-h-11 items-start gap-3 py-2.5";
  return driver.href ? (
    <Link href={driver.href} className={cn(cls, "group -mx-2 rounded-adm px-2 transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
