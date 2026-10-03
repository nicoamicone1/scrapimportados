import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

/**
 * "Te faltan $ X para el envío gratis" con barra de progreso (P0-20).
 * `partial`: el umbral sale de las zonas y no aplica a todas.
 */
export function FreeShippingBar({
  threshold,
  amount,
  partial,
  className,
}: {
  threshold: number | null;
  /** Mercadería después de promos y cupón. */
  amount: number;
  partial?: boolean;
  className?: string;
}) {
  if (!threshold || threshold <= 0) return null;
  const missing = Math.max(0, threshold - amount);
  const pct = Math.min(100, Math.round((amount / threshold) * 100));
  return (
    <div className={cn("ship-bar text-sm", className)} data-done={missing > 0 ? undefined : "1"}>
      <p className="tnum flex flex-wrap items-center gap-x-1.5">
        {missing > 0 ? (
          <>
            Te faltan <strong className="font-semibold">{formatMoney(Math.ceil(missing))}</strong> para el envío gratis
          </>
        ) : (
          <span key="done" className="st-pop inline-flex items-center gap-1.5 font-semibold text-success">
            <Check className="size-4" aria-hidden strokeWidth={2.25} />
            Tenés envío gratis
          </span>
        )}
        {partial ? <span className="text-fg-muted"> (en zonas seleccionadas)</span> : null}
      </p>
      <div
        className="ship-track mt-2 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Progreso hacia el envío gratis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="ship-fill h-full w-full rounded-full bg-primary" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}
