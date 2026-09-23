"use client";

import { Clock, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { FREE_BANNER_COOKIE, FREE_BANNER_DISMISS_DAYS, type TrialBannerState } from "@/lib/plans/trial-banner";

const PLAN_PAGE = "/admin/plan";

/**
 * Franja fina arriba del contenido del panel con el estado de la prueba
 * (`trialBannerState`, calculado en el layout). En `/admin/plan` no se
 * muestra: ahí ya está el detalle. La de Free se cierra por 7 días (cookie
 * que lee el layout, así no parpadea al recargar).
 */
export function TrialBanner({ state }: { state: Exclude<TrialBannerState, { kind: "none" }> }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  if (hidden || pathname === PLAN_PAGE || pathname.startsWith(`${PLAN_PAGE}/`)) return null;

  const link = (
    <Link href={PLAN_PAGE} className="shrink-0 font-medium text-adm-accent underline-offset-2 hover:underline">
      Ver planes
    </Link>
  );

  if (state.kind === "free") {
    const dismiss = () => {
      document.cookie = `${FREE_BANNER_COOKIE}=1; path=/admin; max-age=${FREE_BANNER_DISMISS_DAYS * 86_400}; samesite=lax`;
      setHidden(true);
    };
    return (
      <aside
        aria-label="Plan de la tienda"
        className="mb-4 flex items-center gap-x-3 gap-y-1 rounded-adm border border-adm-border bg-adm-surface px-3 py-1.5 text-[13px] text-adm-fg-muted"
      >
        <p className="min-w-0 flex-1">
          {state.message} {link}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Ocultar este aviso por ${FREE_BANNER_DISMISS_DAYS} días`}
          title={`Ocultar por ${FREE_BANNER_DISMISS_DAYS} días`}
          className="-my-1 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-adm-sm text-adm-fg-muted hover:bg-adm-surface-2 hover:text-adm-fg"
        >
          <X className="size-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      </aside>
    );
  }

  const { tone } = state;
  return (
    <aside
      aria-label="Prueba gratis"
      className={cn(
        "mb-4 flex items-center gap-2.5 rounded-adm border px-3 py-1.5 text-[13px]",
        tone === "neutral" && "border-adm-border bg-adm-surface text-adm-fg-muted",
        tone === "warning" && "border-adm-accent-2/60 bg-adm-accent-2-soft text-adm-fg",
        tone === "urgent" && "border-adm-accent-2 bg-adm-accent-2-soft text-adm-fg",
      )}
    >
      <Clock
        className={cn("size-4 shrink-0", tone === "neutral" ? "text-adm-fg-muted" : "text-adm-accent-2-ink")}
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="min-w-0 flex-1">
        {tone === "urgent" ? (
          <>
            <span className="font-medium">
              Tu prueba de {state.planName} termina {state.endsOn === "today" ? "hoy" : "mañana"} a las{" "}
              <span className="tnum">{state.endsAtTime}</span>.
            </span>{" "}
            Si no elegís un plan, la tienda pasa a Free: no se borra nada, pero lo que excede Free queda bloqueado.{" "}
          </>
        ) : (
          <>
            Te quedan{" "}
            <span className={cn("tnum font-medium", tone === "neutral" && "text-adm-fg")}>
              {state.daysLeft} {state.daysLeft === 1 ? "día" : "días"}
            </span>{" "}
            de {state.planName} gratis · hasta el {state.endsAtDate}.
            {tone === "warning" ? " Después, si no elegís un plan, la tienda pasa a Free sin perder nada." : null}{" "}
          </>
        )}
        {link}
      </p>
    </aside>
  );
}
