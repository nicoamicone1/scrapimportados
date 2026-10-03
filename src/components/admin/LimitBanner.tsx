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
 * Aviso de uso vs. límite del plan (BRAND §10): fondo pomelo lavado, radio
 * 16 px, número concreto (con la barra de uso) + consecuencia + "Ver planes".
 * Aparece desde el 80 % del límite (antes de chocarlo); no se muestra si el
 * límite es ilimitado.
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
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-adm-lg bg-adm-accent-2-soft py-2 pr-2 pl-3 text-[13px] text-adm-fg",
        reached && "ring-1 ring-adm-accent-2 ring-inset",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "eco-bubble inline-flex size-7 shrink-0 items-center justify-center [--eco-bubble-r:10px]",
          reached ? "bg-adm-accent-2 text-adm-accent-2-fg" : "bg-adm-surface text-adm-accent-2-ink",
        )}
      >
        <Lock className="size-3.5" strokeWidth={1.75} />
      </span>
      {/* Barra de uso: el número se ve, no sólo se lee. */}
      <span aria-hidden className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-adm-surface sm:block">
        <span className="block h-full rounded-full bg-adm-accent-2" style={{ width: `${pct}%` }} />
      </span>
      <span className="min-w-0 flex-1">
        {reached ? (
          <>
            Llegaste al máximo de <span className="font-semibold tabular-nums">{max}</span> {unit} del plan {effective.name}. Para sumar más, pasate a {next}.
          </>
        ) : (
          <>
            Usás <span className="font-semibold tabular-nums">{used}</span> de <span className="tabular-nums">{max}</span> {unit} del plan {effective.name}. Al llegar a{" "}
            <span className="tabular-nums">{max}</span> no vas a poder sumar más; lo que ya tenés no se toca.
          </>
        )}
      </span>
      <Link
        href={PLAN_PAGE}
        className="inline-flex h-8 shrink-0 items-center rounded-full bg-adm-accent px-3.5 text-[13px] font-medium text-adm-accent-fg transition-colors duration-[140ms] hover:bg-adm-accent-hover pointer-coarse:h-10"
      >
        Ver planes
      </Link>
    </div>
  );
}
