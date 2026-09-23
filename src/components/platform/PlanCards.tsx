import { Check, Minus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { planPriceLabel, type PublicPlan } from "@/lib/plans/catalog";
import { FEATURE_KEYS, FEATURES, LIMITS, type LimitKey, type PlanInfo } from "@/lib/plans";
import { yearlyLine } from "@/lib/plans/yearly";

/** Renglones de límites que importan para elegir (en ese orden). */
function limitLines(plan: PlanInfo): string[] {
  const l = plan.limits;
  const out: string[] = [];
  out.push(l.products === null ? "Productos ilimitados" : `Hasta ${l.products.toLocaleString("es-AR")} productos`);
  if (l.pages === null) out.push("Landings ilimitadas");
  else if (l.pages <= 1) out.push("Página de inicio editable");
  else out.push(`Inicio + ${l.pages - 1} landings`);
  if (l.staff === null) out.push("Equipo sin límite");
  else out.push(l.staff === 1 ? "1 usuario" : `Hasta ${l.staff} usuarios`);
  return out;
}

/** Features que agrega un plan respecto del anterior. */
function newFeatures(plan: PlanInfo, prev: PlanInfo | null): string[] {
  return FEATURE_KEYS.filter((k) => plan.features[k] && !(prev?.features[k] ?? false)).map((k) => FEATURES[k].label);
}

export interface PlanCardsProps {
  plans: PublicPlan[];
  /** CTA por plan (link o botón). */
  renderCta: (plan: PublicPlan) => ReactNode;
  /** Código del plan a destacar (borde pino + "Recomendado"). */
  highlight?: string;
  /** Código del plan actual (muestra "Tu plan"). */
  current?: string;
  className?: string;
}

/** Tarjetas de planes (landing, /planes, /admin/plan). Server-safe. */
export function PlanCards({ plans, renderCta, highlight, current, className }: PlanCardsProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {plans.map((plan, i) => {
        const prev = i > 0 ? plans[i - 1] : null;
        const price = planPriceLabel(plan);
        const yearly = yearlyLine(plan);
        const extras = newFeatures(plan, prev);
        const isHighlight = plan.code === highlight;
        return (
          <article
            key={plan.code}
            className={cn(
              "flex flex-col rounded-adm border bg-adm-surface p-5 shadow-adm-card",
              isHighlight ? "border-adm-accent ring-1 ring-adm-accent" : "border-adm-border",
            )}
          >
            <header className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">{plan.name}</h3>
              {plan.code === current ? (
                <span className="rounded-[4px] bg-adm-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-adm-accent">Tu plan</span>
              ) : isHighlight ? (
                <span className="rounded-[4px] bg-adm-accent-2-soft px-1.5 py-0.5 text-[11px] font-medium text-adm-accent-2-ink">Recomendado</span>
              ) : null}
            </header>
            {plan.description ? <p className="mt-1 text-[13px] text-adm-fg-muted">{plan.description}</p> : null}
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em]">{price.amount}</span>
              {price.suffix ? <span className="text-[13px] text-adm-fg-muted">{price.suffix}</span> : null}
            </p>
            {yearly ? <p className="tnum mt-2 text-[12px] leading-snug text-adm-fg-muted">{yearly}</p> : null}
            <ul className="mt-4 space-y-1.5 border-t border-adm-border pt-4 text-[13px]">
              {limitLines(plan).map((line) => (
                <li key={line} className="font-medium">
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-adm-fg-muted">{prev ? `Todo lo de ${prev.name}, más:` : "Incluye:"}</p>
            <ul className="mt-2 flex-1 space-y-1.5 text-[13px]">
              {extras.length ? (
                extras.map((label) => (
                  <li key={label} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-adm-accent" strokeWidth={2} aria-hidden />
                    <span>{label}</span>
                  </li>
                ))
              ) : (
                <li className="text-adm-fg-muted">Más capacidad y acompañamiento a medida.</li>
              )}
            </ul>
            <div className="mt-5">{renderCta(plan)}</div>
          </article>
        );
      })}
    </div>
  );
}

function limitCell(plan: PlanInfo, key: LimitKey): string {
  const v = plan.limits[key];
  if (v === null) return "Sin límite";
  if (key === "storage_mb") return v >= 1000 ? `${(v / 1000).toLocaleString("es-AR")} GB` : `${v} MB`;
  return v.toLocaleString("es-AR");
}

/** Tabla comparativa completa (features × planes). */
export function PlanComparison({ plans }: { plans: PlanInfo[] }) {
  const limitKeys: LimitKey[] = ["products", "pages", "staff", "promotions", "coupons", "images_per_product", "import_jobs_month", "storage_mb"];
  return (
    <div className="overflow-x-auto rounded-adm border border-adm-border bg-adm-surface">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-adm-border bg-adm-table-head text-left">
            <th className="px-4 py-2.5 font-medium text-adm-fg-muted">Capacidad</th>
            {plans.map((p) => (
              <th key={p.code} className="w-32 px-3 py-2.5 font-semibold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {limitKeys.map((k) => (
            <tr key={k} className="border-b border-adm-border">
              <td className="px-4 py-2">{LIMITS[k].label}</td>
              {plans.map((p) => (
                <td key={p.code} className="tnum px-3 py-2">
                  {limitCell(p, k)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-b border-adm-border bg-adm-table-head">
            <td colSpan={plans.length + 1} className="px-4 py-2 font-medium text-adm-fg-muted">
              Funciones
            </td>
          </tr>
          {FEATURE_KEYS.map((k) => (
            <tr key={k} className="border-b border-adm-border last:border-b-0">
              <td className="px-4 py-2">{FEATURES[k].label}</td>
              {plans.map((p) => (
                <td key={p.code} className="px-3 py-2">
                  {p.features[k] ? (
                    <Check className="size-4 text-adm-accent" strokeWidth={2} aria-label="Incluido" />
                  ) : (
                    <Minus className="size-4 text-adm-fg-subtle" aria-label="No incluido" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Link-botón estándar de los CTA de planes. */
export function PlanCtaLink({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 w-full items-center justify-center rounded-adm px-3 text-sm font-medium transition-colors",
        primary
          ? "bg-adm-accent text-adm-accent-fg hover:bg-adm-accent-hover"
          : "border border-adm-input-border bg-adm-surface text-adm-fg hover:bg-adm-hover",
      )}
    >
      {children}
    </Link>
  );
}
