import { cn } from "@/lib/cn";

import { isLightHex } from "./Swatch";

/**
 * Bobina vista de frente: brida, filamento enrollado (el anillo crece con
 * los gramos que quedan) y el buje. Vacía = sólo el carrete.
 */
export function SpoolGlyph({ hex, fill, className }: { hex: string; fill: number; className?: string }) {
  const hub = 7;
  const max = 20;
  const r = fill > 0 ? hub + 1.5 + (max - hub - 1.5) * Math.min(1, fill) : 0;
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("block", className)}>
      <circle cx={24} cy={24} r={22.5} fill="var(--adm-surface-2)" stroke="var(--adm-input-border)" strokeWidth={1} />
      {r > 0 ? (
        <circle
          cx={24}
          cy={24}
          r={r}
          fill={hex}
          stroke={isLightHex(hex) ? "var(--adm-input-border)" : "none"}
          strokeWidth={isLightHex(hex) ? 1 : 0}
        />
      ) : null}
      {r > 0 ? <circle cx={24} cy={24} r={r - 2.5} fill="none" stroke="rgb(0 0 0 / .12)" strokeWidth={0.75} /> : null}
      <circle cx={24} cy={24} r={hub} fill="var(--adm-surface)" stroke="var(--adm-input-border)" strokeWidth={1} />
      <circle cx={24} cy={24} r={2.5} fill="var(--adm-surface-2)" stroke="var(--adm-input-border)" strokeWidth={0.75} />
    </svg>
  );
}
