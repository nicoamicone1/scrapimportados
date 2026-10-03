"use client";

import { ArrowRight, Clock, CreditCard, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { FREE_BANNER_COOKIE, FREE_BANNER_DISMISS_DAYS, type TrialBannerState } from "@/lib/plans/trial-banner";

const PLAN_PAGE = "/admin/plan";

/**
 * Franja arriba del contenido del panel con el estado de la prueba
 * (`trialBannerState`, calculado en el layout). BRAND §10: fondo pomelo
 * lavado, texto tinta, radio 16 px, número concreto + consecuencia + "Ver
 * planes". En `/admin/plan` no se muestra: ahí ya está el detalle. La de Free
 * (neutra, blanca) se cierra por 7 días (cookie que lee el layout, así no
 * parpadea al recargar).
 */
export function TrialBanner({ state }: { state: Exclude<TrialBannerState, { kind: "none" }> }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  if (hidden || pathname === PLAN_PAGE || pathname.startsWith(`${PLAN_PAGE}/`)) return null;

  const link = (
    <Link
      href={PLAN_PAGE}
      className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-adm-accent pr-2.5 pl-3.5 text-[13px] font-medium text-adm-accent-fg transition-colors duration-[140ms] hover:bg-adm-accent-hover pointer-coarse:h-10"
    >
      Ver planes
      <ArrowRight className="size-3.5 transition-transform duration-[240ms] ease-eco-out group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );

  if (state.kind === "free") {
    const dismiss = () => {
      // `secure` sólo en https (en localhost por http el navegador descartaría la cookie).
      const secure = location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${FREE_BANNER_COOKIE}=1; path=/admin; max-age=${FREE_BANNER_DISMISS_DAYS * 86_400}; samesite=lax${secure}`;
      setHidden(true);
    };
    return (
      <aside
        aria-label="Plan de la tienda"
        className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-adm-lg border border-adm-border bg-adm-surface py-2 pr-2 pl-3 text-[13px] text-adm-fg-muted"
      >
        <span aria-hidden className="eco-bubble inline-flex size-7 shrink-0 items-center justify-center bg-eco-durazno text-eco-ink [--eco-bubble-r:10px]">
          <CreditCard className="size-3.5" strokeWidth={1.75} />
        </span>
        <p className="min-w-0 flex-1">{state.message}</p>
        {link}
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Ocultar este aviso por ${FREE_BANNER_DISMISS_DAYS} días`}
          title={`Ocultar por ${FREE_BANNER_DISMISS_DAYS} días`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-adm-fg-muted transition-colors duration-[140ms] hover:bg-adm-surface-2 hover:text-adm-fg pointer-coarse:size-11"
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
        "mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-adm-lg py-2 pr-2 pl-3 text-[13px] text-adm-fg",
        tone === "neutral" && "bg-adm-accent-2-soft/70",
        tone === "warning" && "bg-adm-accent-2-soft",
        tone === "urgent" && "bg-adm-accent-2-soft ring-1 ring-adm-accent-2 ring-inset",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "eco-bubble inline-flex size-7 shrink-0 items-center justify-center [--eco-bubble-r:10px]",
          tone === "urgent" ? "bg-adm-accent-2 text-adm-accent-2-fg" : "bg-adm-surface text-adm-accent-2-ink",
        )}
      >
        <Clock className="size-3.5" strokeWidth={1.75} />
      </span>
      <p className="min-w-0 flex-1">
        {tone === "urgent" ? (
          <>
            <span className="font-medium">
              Tu prueba de {state.planName} termina {state.endsOn === "today" ? "hoy" : "mañana"} a las{" "}
              <span className="tnum">{state.endsAtTime}</span>.
            </span>{" "}
            Si no elegís un plan, la tienda pasa a Free: no se borra nada, pero lo que excede Free queda bloqueado.
          </>
        ) : (
          <>
            Te quedan{" "}
            <span className="tnum font-semibold">
              {state.daysLeft} {state.daysLeft === 1 ? "día" : "días"}
            </span>{" "}
            de {state.planName} gratis · hasta el {state.endsAtDate}.
            {tone === "warning" ? " Después, si no elegís un plan, la tienda pasa a Free sin perder nada." : null}
          </>
        )}
      </p>
      {link}
    </aside>
  );
}
