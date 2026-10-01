import { Check } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import type { AdminContext } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding";
import { storeDisplayHost, storeUrl } from "@/lib/tenant/urls";

import { DismissOnboarding, ShareStoreLink } from "./OnboardingActions";

/**
 * Checklist de primeros pasos (spec §14.3 / §14.6): tarjeta destacada
 * arriba del dashboard hasta completarse. Se tilda sola mirando la base
 * (`src/lib/onboarding.ts`); "compartí tu link" se marca al copiarlo.
 * Devuelve `null` cuando está completo u oculto.
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
  if (status.dismissed || status.completed === status.steps.length) return null;
  const url = storeUrl(ctx.store);
  const nextId = status.steps.find((s) => !s.done)?.id;
  const pct = Math.round((status.completed / status.steps.length) * 100);

  return (
    <section aria-labelledby="onboarding-title" className="rounded-adm border border-adm-accent/20 bg-adm-accent-soft">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-adm-accent/15 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.07em] text-adm-accent uppercase">Primeros pasos</p>
          <h2 id="onboarding-title" className="text-[15px] font-semibold">
            Dejá lista tu tienda · {status.completed} de {status.steps.length}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-[2px] bg-adm-surface" aria-hidden>
            <div className="h-full bg-adm-accent" style={{ width: `${pct}%` }} />
          </div>
          <DismissOnboarding />
        </div>
      </header>
      <ol className="divide-y divide-adm-accent/15">
        {status.steps.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className={cn(
                  "tnum mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-adm-sm border text-[11px] font-medium",
                  s.done ? "border-adm-accent bg-adm-accent text-adm-accent-fg" : "border-adm-input-border bg-adm-surface text-adm-fg-muted",
                )}
              >
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", s.done && "text-adm-fg-muted line-through decoration-adm-input-border")}>
                  {s.title}
                  <span className="sr-only">{s.done ? " (listo)" : " (pendiente)"}</span>
                </p>
                <p className="text-[13px] text-adm-fg-muted">
                  {s.id === "shared" ? (
                    <>
                      Tu tienda está en <span className="font-medium text-adm-fg">{storeDisplayHost(ctx.store)}</span>. {s.description}
                    </>
                  ) : (
                    s.description
                  )}
                </p>
              </div>
            </div>
            {s.id === "shared" ? (
              s.done ? null : <ShareStoreLink url={url} storeName={ctx.store.name} moreHref={s.href} primary={s.id === nextId} />
            ) : s.done ? null : (
              <ButtonLink href={s.href} size="sm" variant={s.id === nextId ? "accent" : "secondary"}>
                {s.cta}
              </ButtonLink>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
