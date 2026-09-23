"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

import { useOptionalAdminStore } from "@/components/admin/AdminStoreContext";
import { PLAN_PAGE } from "@/components/admin/PlanGate";
import { cn } from "@/lib/cn";
import { LIMITS, limitMinPlan, limitOf, PLAN_NAMES, type LimitKey, type PlanInfo } from "@/lib/plans";

export interface LimitBannerProps {
  limit: LimitKey;
  /** Uso actual (ej. cantidad de productos). */
  used: number;
  /** Desde qué fracción del límite se muestra (default 0.8). */
  threshold?: number;
  plan?: Pick<PlanInfo, "limits" | "name"> | null;
  className?: string;
}

/**
 * Aviso discreto de uso vs. límite del plan ("Usás 46 de 50 productos del
 * plan Free · Ver planes"). No se muestra si el límite es ilimitado o si el
 * uso está por debajo del umbral.
 */
export function LimitBanner({ limit, used, threshold = 0.8, plan, className }: LimitBannerProps) {
  const ctx = useOptionalAdminStore();
  const effective = plan ?? ctx?.plan ?? null;
  if (!effective) return null;
  const max = limitOf(effective, limit);
  if (max === null || used < Math.floor(max * threshold)) return null;

  const reached = used >= max;
  const { unit } = LIMITS[limit];
  const next = PLAN_NAMES[limitMinPlan(limit, max + 1)];

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-adm border px-3 py-2 text-[13px]",
        reached ? "border-adm-accent-2/60 bg-adm-accent-2-soft text-adm-fg" : "border-adm-border bg-adm-surface text-adm-fg-muted",
        className,
      )}
    >
      <Lock className={cn("size-3.5 shrink-0", reached ? "text-adm-accent-2-ink" : "")} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">
        {reached ? (
          <>
            Llegaste al máximo de <span className="tabular-nums">{max}</span> {unit} del plan {effective.name}. Para sumar más, pasate a {next}.
          </>
        ) : (
          <>
            Usás <span className="tabular-nums">{used}</span> de <span className="tabular-nums">{max}</span> {unit} del plan {effective.name}.
          </>
        )}
      </span>
      <Link href={PLAN_PAGE} className="font-medium text-adm-accent underline-offset-2 hover:underline">
        Ver planes
      </Link>
    </div>
  );
}
