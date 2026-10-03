import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import type { AdminContext } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding";
import { storeDisplayHost, storeUrl } from "@/lib/tenant/urls";

import { DrawnCheck } from "./DrawnCheck";
import { DismissOnboarding, ShareStoreLink } from "./OnboardingActions";
import { ProgressArc } from "./ProgressArc";

/**
 * Primeros pasos (spec §14.3 / §14.6; BRAND §1 "la tienda en una tarde").
 * El progreso va en el arco de la "e"; el siguiente paso es una burbuja
 * pomelo con el único botón pomelo de la pantalla ("empezá por acá"); los
 * demás pasos quedan como una lista corta, y los hechos llevan un check que se
 * dibuja. Se tilda sola mirando la base (`src/lib/onboarding.ts`); "compartí
 * tu link" se marca al copiarlo. Devuelve `null` cuando está completo u oculto.
 */
export async function OnboardingChecklist({
  ctx,
  status: given,
}: {
  ctx: Pick<AdminContext, "supabase" | "store">;
  /** Si la página ya lo leyó (para decidir la acción primaria), se reusa. */
  status?: OnboardingStatus;
}) {
  const status = given ?? (await getOnboardingStatus(ctx));
  const total = status.steps.length;
  if (status.dismissed || status.completed === total) return null;
  const url = storeUrl(ctx.store);
  const nextIndex = status.steps.findIndex((s) => !s.done);
  const next = status.steps[nextIndex];
  const left = total - status.completed;

  return (
    <section aria-labelledby="onboarding-title" className="eco-pop overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card">
      <header className="flex items-center gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
        <ProgressArc value={status.completed} max={total} size={68} label={`${status.completed} de ${total} pasos listos`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-adm-accent-2-ink uppercase">Primeros pasos</p>
          <h2 id="onboarding-title" className="eco-display mt-1 text-[20px] leading-6 text-adm-fg sm:text-[22px]">
            Dejá lista tu tienda
          </h2>
          <p className="mt-1 text-[13px] text-adm-fg-muted">
            {left === 1 ? "Te falta un paso." : `Te faltan ${left} pasos.`} Cada uno se tilda solo cuando lo terminás.
          </p>
        </div>
        <div className="self-start">
          <DismissOnboarding />
        </div>
      </header>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* El paso siguiente: la burbuja que habla (BRAND §7.2). */}
        {next ? (
          <div className="eco-bubble relative overflow-hidden bg-adm-accent-2-soft p-4 sm:p-5 [--eco-bubble-r:24px]">
            <svg aria-hidden viewBox="0 0 120 120" className="pointer-events-none absolute -right-8 -bottom-10 size-36 text-eco-durazno">
              <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="14" />
            </svg>
            <div className="relative">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-adm-accent-2-ink uppercase">
                Empezá por acá · paso {nextIndex + 1} de {total}
              </p>
              <h3 className="mt-1.5 text-[17px] leading-6 font-semibold text-adm-fg">{next.title}</h3>
              <p className="mt-1 max-w-[46ch] text-[13px] text-adm-fg">
                {next.id === "shared" ? (
                  <>
                    Tu tienda está en <span className="font-semibold">{storeDisplayHost(ctx.store)}</span>. {next.description}
                  </>
                ) : (
                  next.description
                )}
              </p>
              <div className="mt-4">
                {next.id === "shared" ? (
                  <ShareStoreLink url={url} storeName={ctx.store.name} moreHref={next.href} primary />
                ) : (
                  <ButtonLink href={next.href} variant="accent" size="lg" iconRight={<ArrowRight className="dsh-go" />} className="group">
                    {next.cta}
                  </ButtonLink>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* El resto: lista corta; los hechos, con su check. */}
        <ol className="space-y-1" aria-label="Todos los pasos">
          {status.steps.map((s, i) => {
            const isNext = i === nextIndex;
            const mark = (
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                  s.done
                    ? "bg-eco-pomelo text-adm-fg"
                    : isNext
                      ? "border-2 border-eco-pomelo bg-adm-surface text-adm-accent-2-ink"
                      : "border border-adm-input-border bg-adm-surface text-adm-fg-muted",
                )}
              >
                {s.done ? <DrawnCheck index={i} /> : i + 1}
              </span>
            );
            const text = (
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[13px] font-medium", s.done ? "text-adm-fg-muted line-through decoration-adm-fg-subtle" : "text-adm-fg")}>
                  {s.title}
                </span>
                <span className="sr-only">{s.done ? " (listo)" : isNext ? " (siguiente)" : " (pendiente)"}</span>
              </span>
            );
            return (
              <li key={s.id}>
                {s.done || isNext ? (
                  <div className={cn("flex min-h-10 items-center gap-3 rounded-adm px-2 py-1.5", isNext && "bg-adm-surface-2")}>
                    {mark}
                    {text}
                    {isNext ? <span className="text-xs font-medium text-adm-accent-2-ink">Ahora</span> : null}
                  </div>
                ) : (
                  <Link
                    href={s.href}
                    className="group flex min-h-10 items-center gap-3 rounded-adm px-2 py-1.5 transition-colors duration-[140ms] ease-eco-out hover:bg-adm-row-hover pointer-coarse:min-h-11"
                  >
                    {mark}
                    {text}
                    <span className="sr-only">: {s.cta}</span>
                    <ArrowRight aria-hidden className="dsh-go size-4 shrink-0 text-adm-link" />
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
