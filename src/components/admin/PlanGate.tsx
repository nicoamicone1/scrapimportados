"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useOptionalAdminStore } from "@/components/admin/AdminStoreContext";
import { cn } from "@/lib/cn";
import { featureMinPlan, hasFeature, PLAN_NAMES, type FeatureKey, type PlanInfo } from "@/lib/plans";

export const PLAN_PAGE = "/admin/plan";

export interface PlanGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /**
   * - `block` (default): bloque discreto en lugar del contenido.
   * - `preview`: muestra el contenido atenuado e inerte, con la nota encima.
   * - `inline`: para botones/acciones: candado + etiqueta que lleva a /admin/plan.
   * - `hidden`: no renderiza nada si no está incluido.
   */
  mode?: "block" | "preview" | "inline" | "hidden";
  /** Etiqueta del modo `inline` (ej. el texto del botón bloqueado). */
  label?: ReactNode;
  /** Texto extra del modo `block`/`preview`. */
  description?: ReactNode;
  /** Plan explícito (server → client). Si falta, se usa el del panel (`useAdminStore`). */
  plan?: Pick<PlanInfo, "features"> | null;
  className?: string;
}

/**
 * Muestra `children` sólo si el plan de la tienda incluye `feature`; si no,
 * un candado lineal con "Disponible en <plan> · Ver planes". Es UI: la
 * action igual tiene que llamar `assertFeature(ctx, feature)`.
 *
 *   <PlanGate feature="pricing.bulk"><BulkPriceWizard … /></PlanGate>
 *   <PlanGate feature="catalog.import_web" mode="inline" label="Importar desde web">…</PlanGate>
 */
export function PlanGate({ feature, children, mode = "block", label, description, plan, className }: PlanGateProps) {
  const ctx = useOptionalAdminStore();
  const effective = plan ?? ctx?.plan ?? null;
  // Fuera del panel (sin plan conocido) no se bloquea nada: la action decide.
  if (!effective || hasFeature(effective, feature)) return <>{children}</>;
  if (mode === "hidden") return null;

  const planName = PLAN_NAMES[featureMinPlan(feature)];

  if (mode === "inline") {
    return (
      <Link
        href={PLAN_PAGE}
        title={`Disponible desde el plan ${planName}`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-adm border border-dashed border-adm-input-border px-3 text-sm text-adm-fg-muted transition-colors hover:border-adm-input-border-hover hover:text-adm-fg",
          className,
        )}
      >
        <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
        {label ?? "Ver planes"}
        <span className="text-[11px] text-adm-fg-muted">· {planName}</span>
      </Link>
    );
  }

  const note = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-adm-border bg-adm-surface text-adm-fg-muted">
        <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-adm-fg">Disponible en {planName}</p>
        {description ? <p className="mt-0.5 text-adm-fg-muted">{description}</p> : null}
        <Link href={PLAN_PAGE} className="mt-1 inline-block text-[13px] font-medium text-adm-accent underline-offset-2 hover:underline">
          Ver planes
        </Link>
      </div>
    </div>
  );

  if (mode === "preview") {
    return (
      <div className={cn("relative", className)}>
        <div inert className="pointer-events-none opacity-40 select-none" aria-hidden>
          {children}
        </div>
        <div className="absolute inset-x-0 top-4 flex justify-center px-4">
          <div className="max-w-md rounded-adm border border-adm-border bg-adm-surface px-4 py-3 shadow-adm-card">{note}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-adm border border-dashed border-adm-input-border bg-adm-surface/60 px-4 py-3.5", className)}>
      {note}
    </div>
  );
}

/** `true` si el plan del panel incluye la feature (para deshabilitar controles sueltos). */
export function usePlanFeature(feature: FeatureKey): boolean {
  const ctx = useOptionalAdminStore();
  return !ctx || hasFeature(ctx.plan, feature);
}
