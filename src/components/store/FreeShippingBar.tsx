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
    <div className={cn("text-sm", className)}>
      <p className="tnum">
        {missing > 0 ? (
          <>
            Te faltan <strong className="font-semibold">{formatMoney(Math.ceil(missing))}</strong> para el envío gratis
          </>
        ) : (
          <>Tenés envío gratis</>
        )}
        {partial ? <span className="text-fg-muted"> (en zonas seleccionadas)</span> : null}
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Progreso hacia el envío gratis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
