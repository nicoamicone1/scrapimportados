import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { planPriceLabel, type PublicPlan } from "@/lib/plans/catalog";
import { FEATURE_KEYS, FEATURES, LIMITS, type LimitKey, type PlanInfo } from "@/lib/plans";
import { monthlyEquivalent, validYearlyOffer, yearlyOffer } from "@/lib/plans/yearly";

import "@/app/(platform)/site.css";

import { DISPLAY, NUM } from "./brand";
import { featureBenefit } from "./plan-notes";

/*
 * Planes (landing, /planes y /admin/plan). Psicología de precios honesta:
 * el plan recomendado es la burbuja (anclaje visual, no un precio tachado
 * inventado), el precio va grande en `.eco-num`, el ahorro del anual se dice
 * en pesos y los límites son números concretos. Server-safe.
 *
 * Contexto: sin `current` (sitio público) la burbuja destacada es tinta con
 * el CTA pomelo; con `current` (panel) es durazno lavado, para que los
 * botones del panel (tinta) se lean encima.
 */

/** Renglones de límites que importan para elegir (en ese orden). */
function limitLines(plan: PlanInfo): { value: string; label: string }[] {
  const l = plan.limits;
  const out: { value: string; label: string }[] = [];
  out.push(l.products === null ? { value: "Sin límite", label: "de productos" } : { value: l.products.toLocaleString("es-AR"), label: "productos" });
  if (l.pages === null) out.push({ value: "Sin límite", label: "de landings" });
  else if (l.pages <= 1) out.push({ value: "1", label: "página de inicio editable" });
  else out.push({ value: `1 + ${l.pages - 1}`, label: "inicio y landings" });
  if (l.staff === null) out.push({ value: "Sin límite", label: "de usuarios" });
  else out.push({ value: String(l.staff), label: l.staff === 1 ? "usuario" : "usuarios" });
  return out;
}

/** Features que agrega un plan respecto del anterior, en lenguaje de beneficio. */
function newFeatures(plan: PlanInfo, prev: PlanInfo | null): string[] {
  return FEATURE_KEYS.filter((k) => plan.features[k] && !(prev?.features[k] ?? false)).map((k) => featureBenefit(k));
}

/**
 * Ahorro del pago anual en pesos (12 meses − anual) y lo que sale por mes.
 * `null` si el plan no tiene un anual que se pueda ofrecer.
 */
export function yearlySavings(plan: Pick<PlanInfo, "priceMonthly" | "priceYearly" | "currency">): { saved: string; perMonth: string; offer: string | null } | null {
  const yearly = validYearlyOffer(plan.priceMonthly, plan.priceYearly);
  if (yearly === null || plan.priceMonthly === null) return null;
  const saved = plan.priceMonthly * 12 - yearly;
  if (saved <= 0) return null;
  const currency = plan.currency || "ARS";
  return {
    saved: formatMoney(saved, { currency }),
    perMonth: formatMoney(monthlyEquivalent(yearly), { currency }),
    offer: yearlyOffer(plan.priceMonthly, plan.priceYearly),
  };
}

/** "$ 14.999" → ["$", "14.999"]; "Gratis" → [null, "Gratis"]. */
function splitAmount(amount: string): [string | null, string] {
  const m = /^([^\d\s]+)\s*([\d.,]+)$/.exec(amount.replace(/ /g, " "));
  return m ? [m[1], m[2]] : [null, amount];
}

export interface PlanCardsProps {
  plans: PublicPlan[];
  /** CTA por plan (link o botón). */
  renderCta: (plan: PublicPlan) => ReactNode;
  /** Código del plan a destacar (la burbuja + etiqueta). */
  highlight?: string;
  /** Etiqueta del plan destacado. En el sitio: "Incluido en la prueba" (la prueba es de Pro). */
  highlightLabel?: string;
  /**
   * Línea de reversión de riesgo bajo el CTA del destacado (opcional). En el
   * sitio: "14 días de Pro, sin tarjeta. Después seguís en Free y no se borra nada."
   */
  highlightNote?: ReactNode;
  /** Código del plan actual (muestra "Tu plan"). */
  current?: string;
  className?: string;
}

/** Tarjetas de planes (landing, /planes, /admin/plan). Server-safe. */
export function PlanCards({ plans, renderCta, highlight, highlightLabel = "Recomendado", highlightNote, current, className }: PlanCardsProps) {
  const panel = current !== undefined;
  return (
    <div className={cn("grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5", className)}>
      {plans.map((plan, i) => {
        const prev = i > 0 ? plans[i - 1] : null;
        const price = planPriceLabel(plan);
        const [symbol, digits] = splitAmount(price.amount);
        const yearly = yearlySavings(plan);
        const extras = newFeatures(plan, prev);
        const isHighlight = plan.code === highlight;
        const dark = isHighlight && !panel;
        const isCurrent = plan.code === current;
        return (
          <article
            key={plan.code}
            aria-label={isHighlight ? `${plan.name}, ${highlightLabel}` : plan.name}
            className={cn(
              "relative flex min-w-0 flex-col p-6 xl:px-5",
              isHighlight
                ? cn("eco-bubble [--eco-bubble-r:28px]", dark ? "bg-eco-ink text-white shadow-[0_32px_64px_-36px_rgb(16_22_47/0.7)] xl:-my-4 xl:py-10" : "bg-eco-pomelo-soft")
                : cn("site-lift border bg-adm-surface", isCurrent ? "border-adm-link ring-1 ring-adm-link" : "border-eco-line"),
            )}
          >
            <header className="flex min-h-7 flex-wrap items-center justify-between gap-2">
              <h3 className={cn(DISPLAY, "text-[22px] leading-none")}>{plan.name}</h3>
              {isCurrent ? (
                <span className="rounded-full bg-eco-azul-soft px-2.5 py-1 text-[12px] font-semibold text-adm-link">Tu plan</span>
              ) : isHighlight ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[12px] font-semibold",
                    dark ? "bg-eco-pomelo text-eco-ink" : "bg-eco-ink text-white",
                  )}
                >
                  {highlightLabel}
                </span>
              ) : null}
            </header>
            {plan.description ? (
              <p className={cn("mt-2 text-[14px] leading-snug sm:min-h-[2.75em]", dark ? "text-eco-bruma" : "text-adm-fg-muted")}>{plan.description}</p>
            ) : null}

            <p className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className={cn(NUM, "flex items-start leading-none")}>
                {symbol ? <span className="mt-1.5 mr-1 text-[20px]">{symbol}</span> : null}
                <span className={cn(digits.length > 7 ? "text-[38px]" : "text-[46px]", "tracking-[-0.04em]")}>{digits}</span>
              </span>
              {price.suffix ? <span className={cn("text-[14px]", dark ? "text-eco-bruma" : "text-adm-fg-muted")}>{price.suffix}</span> : null}
            </p>
            {yearly ? (
              <p
                className={cn(
                  "tnum mt-3 w-fit rounded-[10px] rounded-bl-[3px] px-2.5 py-1.5 text-[12.5px] leading-snug",
                  dark ? "bg-eco-ink-2 text-eco-mist" : isHighlight ? "bg-adm-surface text-adm-fg" : "bg-eco-durazno/60 text-eco-ink",
                )}
              >
                Pagando el año: <span className="font-semibold">{yearly.perMonth} por mes</span>
                <span className="block">
                  Ahorrás <span className="font-semibold">{yearly.saved}</span>
                  {yearly.offer?.startsWith("12 meses") ? ` (${yearly.offer})` : ""}
                </span>
              </p>
            ) : null}

            <ul className={cn("mt-6 space-y-2 border-t pt-5", dark ? "border-eco-ink-3" : "border-eco-line")}>
              {limitLines(plan).map((line) => (
                <li key={line.label} className="flex items-baseline gap-2 text-[14px]">
                  <span className={cn(NUM, "text-[17px]")}>{line.value}</span>
                  <span className={dark ? "text-eco-mist" : "text-adm-fg"}>{line.label}</span>
                </li>
              ))}
            </ul>

            <p className={cn("mt-5 text-[12px] font-semibold tracking-[0.06em] uppercase", dark ? "text-eco-bruma" : "text-adm-fg-muted")}>
              {prev ? `Todo lo de ${prev.name}, más` : "Incluye"}
            </p>
            <ul className="mt-2.5 flex-1 space-y-2 text-[14px] leading-snug">
              {extras.length ? (
                extras.map((label) => (
                  <li key={label} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full rounded-bl-[3px]",
                        dark ? "bg-eco-pomelo text-eco-ink" : "bg-eco-durazno text-eco-ink",
                      )}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span>{label}</span>
                  </li>
                ))
              ) : (
                <li className={dark ? "text-eco-bruma" : "text-adm-fg-muted"}>Más capacidad y acompañamiento a medida.</li>
              )}
            </ul>
            <div className={cn("mt-7", dark && "[&_.site-pill-secondary]:border-white/40 [&_.site-pill-secondary]:text-white")}>{renderCta(plan)}</div>
            {isHighlight && highlightNote ? (
              <p className={cn("mt-3 text-center text-[12.5px] leading-snug", dark ? "text-eco-mist" : "text-adm-fg-muted")}>{highlightNote}</p>
            ) : null}
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

/**
 * Tabla comparativa completa (features × planes). En desktop es una tabla
 * con la columna del destacado lavada; en el celular cada fila se vuelve un
 * bloque (nombre arriba y una celda por plan, con su nombre), sin scroll
 * horizontal a 360 px.
 */
export function PlanComparison({ plans, highlight }: { plans: PlanInfo[]; highlight?: string }) {
  const limitKeys: LimitKey[] = ["products", "pages", "staff", "promotions", "coupons", "images_per_product", "import_jobs_month", "storage_mb"];
  const cols = plans.length;
  const rowGrid = "max-md:grid max-md:grid-cols-[repeat(var(--cols),minmax(0,1fr))] max-md:gap-x-1 max-md:py-2.5";
  const cell = (p: PlanInfo, content: ReactNode) => (
    <td
      key={p.code}
      className={cn(
        "px-3 py-3 text-[14px] md:text-center",
        "max-md:flex max-md:flex-col max-md:items-center max-md:rounded-[10px] max-md:px-1 max-md:py-1 max-md:text-[13px]",
        p.code === highlight && "bg-eco-pomelo-soft md:bg-eco-pomelo-soft/70",
      )}
    >
      <span aria-hidden className="text-[11px] font-semibold text-adm-fg-muted md:hidden">
        {p.name}
      </span>
      {content}
    </td>
  );
  const group = (title: string) => (
    <tr className="max-md:block">
      <th
        scope="colgroup"
        colSpan={cols + 1}
        className={cn(DISPLAY, "px-4 pt-8 pb-3 text-left text-[18px] max-md:block max-md:px-0")}
      >
        {title}
      </th>
    </tr>
  );
  return (
    <div className="rounded-eco-lg border border-eco-line bg-adm-surface max-md:border-0 max-md:bg-transparent" style={{ "--cols": cols } as CSSProperties}>
      <table className="w-full border-collapse max-md:block">
        <caption className="sr-only">Comparación de límites y funciones por plan</caption>
        <thead className="max-md:sr-only">
          <tr>
            <th scope="col" className="w-[34%] px-4 pt-5 pb-3 text-left text-[13px] font-medium text-adm-fg-muted">
              Qué incluye
            </th>
            {plans.map((p) => (
              <th
                key={p.code}
                scope="col"
                className={cn(
                  DISPLAY,
                  "px-3 pt-5 pb-3 text-center text-[17px]",
                  p.code === highlight && "rounded-t-[16px] bg-eco-pomelo-soft/70",
                )}
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:block">
          {group("Capacidad")}
          {limitKeys.map((k) => (
            <tr key={k} className={cn("border-t border-eco-line", rowGrid)}>
              <th scope="row" className="px-4 py-3 text-left text-[14px] font-normal max-md:col-span-full max-md:px-0 max-md:pb-1 max-md:font-medium">
                {LIMITS[k].label}
              </th>
              {plans.map((p) => cell(p, <span className={cn("tnum font-medium", p.limits[k] === null && "text-adm-fg-muted")}>{limitCell(p, k)}</span>))}
            </tr>
          ))}
          {group("Funciones")}
          {FEATURE_KEYS.map((k) => (
            <tr key={k} className={cn("border-t border-eco-line", rowGrid)}>
              <th scope="row" className="px-4 py-3 text-left text-[14px] font-normal max-md:col-span-full max-md:px-0 max-md:pb-1 max-md:font-medium">
                {FEATURES[k].label}
              </th>
              {plans.map((p) =>
                cell(
                  p,
                  p.features[k] ? (
                    <Check className="size-[18px] text-eco-pomelo-ink md:inline" strokeWidth={2.5} aria-label="Incluido" />
                  ) : (
                    <Minus className="size-4 text-adm-fg-subtle md:inline" strokeWidth={1.75} aria-label="No incluido" />
                  ),
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Link-botón de los CTA de planes: pastilla de 48 px. `primary` es el CTA de
 * marca (pomelo con texto tinta y la flecha en un círculo tinta, uno por
 * vista); el resto, pastilla con borde.
 */
export function PlanCtaLink({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "site-pill group w-full",
        primary
          ? "justify-between bg-eco-pomelo pr-1.5 pl-5 text-left text-[14px] leading-tight text-eco-ink hover:bg-eco-pomelo-dark"
          : "site-pill-secondary border-2 border-eco-ink px-5 text-eco-ink hover:bg-eco-ink hover:text-white",
      )}
    >
      <span>{children}</span>
      {primary ? (
        <span aria-hidden className="site-arrow inline-flex size-9 items-center justify-center rounded-full bg-eco-ink text-white">
          <ArrowRight className="size-4" strokeWidth={2} />
        </span>
      ) : null}
    </Link>
  );
}
