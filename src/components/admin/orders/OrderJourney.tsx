import { Fragment } from "react";

import { DrawnCheck } from "@/components/admin/dashboard/DrawnCheck";
import { orderStatusLabel } from "@/lib/admin/order-utils";
import { cn } from "@/lib/cn";

/*
 * El recorrido de un pedido (Recibido → Confirmado → En preparación →
 * Enviado/Listo para retirar → Entregado/Retirado) como un camino con curva:
 * los pasos hechos en pomelo con su check, el actual en tinta y los que
 * faltan punteados. Sirve en server y client components. Un cancelado no
 * tiene recorrido (lo dice el aviso del detalle).
 */

const FLOW = ["pending", "confirmed", "preparing", "shipped", "delivered"] as const;

function stepLabel(s: (typeof FLOW)[number], fulfillment?: string | null) {
  return s === "pending" ? "Recibido" : orderStatusLabel(s, fulfillment);
}

export function OrderJourney({ status, fulfillment, className }: { status: string; fulfillment?: string | null; className?: string }) {
  const at = FLOW.indexOf(status as (typeof FLOW)[number]);
  if (at < 0) return null;
  // Entregado es el final: también se marca como hecho.
  const doneUpTo = status === "delivered" ? at : at - 1;
  return (
    <ol aria-label="Recorrido del pedido" className={cn("flex items-start px-7 pb-8 sm:px-10", className)}>
      {FLOW.map((s, i) => {
        const done = i <= doneUpTo;
        const current = i === at && status !== "delivered";
        const label = stepLabel(s, fulfillment);
        return (
          <Fragment key={s}>
            {i > 0 ? (
              <li aria-hidden className="relative mx-1 h-7 min-w-4 flex-1">
                <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                  <path
                    d="M0 14 C 30 1, 70 1, 100 14"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={i <= doneUpTo || (i === at && current) ? 2.5 : 1.5}
                    strokeDasharray={i <= at ? undefined : "3 4"}
                    strokeLinecap="round"
                    className={i <= at ? "stroke-eco-pomelo" : "stroke-adm-input-border"}
                  />
                </svg>
              </li>
            ) : null}
            <li className="relative flex shrink-0 flex-col items-center" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "relative inline-flex size-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                  done && "bg-eco-pomelo text-adm-fg",
                  current && "bg-adm-fg text-white ring-4 ring-adm-accent-2-soft",
                  !done && !current && "border border-dashed border-adm-input-border bg-adm-surface text-adm-fg-muted",
                )}
              >
                {done ? <DrawnCheck index={i} className="size-4" /> : current ? <span className="size-2 rounded-full bg-eco-pomelo" /> : i + 1}
              </span>
              <span
                className={cn(
                  "absolute top-9 left-1/2 w-max max-w-24 -translate-x-1/2 text-center text-[11px] leading-[14px] sm:text-xs",
                  current ? "font-semibold text-adm-fg" : done ? "font-medium text-adm-fg" : "text-adm-fg-muted",
                  // En el celular no entran las cinco etiquetas: queda la del paso actual (las demás, para lectores).
                  !current && !(status === "delivered" && i === FLOW.length - 1) && "max-sm:sr-only",
                )}
              >
                {label}
                <span className="sr-only">{done ? " (hecho)" : current ? " (ahora)" : " (falta)"}</span>
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Versión mínima para listas: cinco tramos, hechos en pomelo y el actual en tinta. */
export function OrderJourneyMini({ status, className }: { status: string; className?: string }) {
  const at = FLOW.indexOf(status as (typeof FLOW)[number]);
  if (at < 0) return null;
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-0.5", className)}>
      {FLOW.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1 w-2.5 rounded-full",
            i < at || status === "delivered" ? "bg-eco-pomelo" : i === at ? "bg-adm-fg" : "bg-adm-border",
          )}
        />
      ))}
    </span>
  );
}
