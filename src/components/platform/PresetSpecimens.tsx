import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import type { PlanInfo } from "@/lib/plans";
import { themeVars } from "@/lib/theme";

import { presetMinPlan, SPECIMEN_BUTTON, type Specimen } from "./specimens";

/** "Incluido en Free" / "Desde Starter" (o nada si no hay planes cargados). */
export function specimenPlanLabel(plans: readonly Pick<PlanInfo, "features" | "name">[], specimen: Specimen): string | null {
  const min = presetMinPlan(plans, specimen.presetId);
  if (!min) return null;
  return min === plans[0] ? `Incluido en ${min.name}` : `Desde ${min.name}`;
}

const heading = "[font-family:var(--font-heading)] [font-weight:var(--heading-weight)] [text-transform:var(--heading-transform)] [letter-spacing:var(--heading-tracking)]";

/*
 * Muestrario "Para quién": cada renglón se pinta con las variables reales
 * del preset (`themeVars`), igual que la miniatura del selector de
 * Apariencia: fondo, tipografías, peso y caja de títulos, acento de promo,
 * forma y estilo del botón. No son íconos ni colores aproximados.
 * La hoja de fuentes la carga la página (`specimenFontsHref`).
 */
export function PresetSpecimens({
  specimens,
  plans,
  className,
}: {
  specimens: readonly Specimen[];
  plans: readonly Pick<PlanInfo, "features" | "name">[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-px overflow-hidden rounded-adm border border-adm-border bg-adm-border lg:grid-cols-2", className)}>
      {specimens.map((s) => {
        const plan = specimenPlanLabel(plans, s);
        const outline = s.theme.buttons.style === "outline";
        return (
          <li
            key={s.kind}
            style={themeVars(s.theme) as CSSProperties}
            className="flex min-w-0 flex-col bg-bg px-4 py-5 text-fg [font-family:var(--font-body)] [font-weight:var(--body-weight)] sm:px-6 sm:py-6"
          >
            <p className="text-[11px] tracking-[0.08em] text-fg-muted uppercase">
              {s.presetName}
              {plan ? <span> · {plan}</span> : null}
            </p>
            <h3 className={cn("mt-2 text-[24px] leading-[1.05] sm:text-[30px]", heading)}>{s.label}</h3>
            <p className="mt-1.5 text-[13px] text-fg-muted">{s.hint}</p>
            <div aria-hidden className="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-border pt-3">
              <div className="min-w-0">
                <p className="truncate text-[13px]">{s.product.name}</p>
                <p className="tnum mt-0.5 text-[14px] [font-weight:var(--body-strong-weight)]">
                  <span className="text-accent">{formatMoney(s.product.price)}</span>
                  <s className="ml-2 text-[12px] text-fg-muted [font-weight:var(--body-weight)]">{formatMoney(s.product.compareAt)}</s>
                </p>
              </div>
              <span
                className={cn(
                  "hidden h-9 shrink-0 items-center rounded-[var(--btn-radius)] px-3.5 text-[12px] [font-weight:var(--body-strong-weight)] [letter-spacing:var(--btn-tracking)] [text-transform:var(--btn-transform)] sm:inline-flex",
                  outline ? "border border-primary text-primary" : "bg-primary text-primary-fg",
                )}
              >
                {SPECIMEN_BUTTON}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
