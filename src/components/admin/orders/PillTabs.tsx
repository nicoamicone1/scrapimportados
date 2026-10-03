import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/money";

export interface PillTab {
  href: string;
  label: string;
  active: boolean;
  count?: number;
  /** Resalta el contador en pomelo (hay algo para resolver). */
  attention?: boolean;
}

/**
 * Vistas rápidas como pastillas (BRAND §10, "Chips y filtros"): la activa en
 * tinta con texto blanco; el contador al lado. En el celular se desplazan
 * de costado sin romper la página.
 */
export function PillTabs({ items, label, className }: { items: PillTab[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("adm-scroll -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0", className)}>
      <ul className="flex w-max gap-1.5">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-[140ms] ease-eco-out pointer-coarse:h-10",
                t.active
                  ? "border-adm-fg bg-adm-fg text-white"
                  : "border-adm-border bg-adm-surface text-adm-fg hover:border-adm-input-border hover:bg-adm-hover",
              )}
            >
              {t.label}
              {t.count !== undefined ? (
                <span
                  className={cn(
                    "tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    t.active ? "bg-white/15 text-white" : t.attention && t.count > 0 ? "bg-eco-pomelo text-adm-fg" : "bg-adm-surface-2 text-adm-fg-muted",
                  )}
                >
                  {formatNumber(t.count)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
