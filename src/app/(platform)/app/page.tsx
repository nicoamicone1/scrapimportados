import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/platform/AppHeader";
import { DISPLAY, FormAlert } from "@/components/platform/brand";
import { CopyText } from "@/components/platform/CopyText";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getProfile, getSession, listMyStores, ROLE_LABELS, type MyStore } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getPlanChip } from "@/lib/plans/chip";
import { parsePlan } from "@/lib/plans";
import { storeDisplayHost, storeHref } from "@/lib/tenant/urls";

import { enterStore } from "./actions";

export const metadata: Metadata = { title: "Mis tiendas" };
export const dynamic = "force-dynamic";

const MAX_STORES = 3;

function planChipFor(s: MyStore) {
  const expiredTrial = s.plan_status === "trialing" && s.trial_ends_at !== null && new Date(s.trial_ends_at).getTime() < Date.now();
  const plan = parsePlan({
    code: expiredTrial ? "free" : (s.plan_code ?? "free"),
    status: expiredTrial ? "active" : (s.plan_status ?? "active"),
    trial_ends_at: expiredTrial ? null : s.trial_ends_at,
  });
  return getPlanChip({ plan });
}

export default async function MisTiendasPage({ searchParams }: PageProps<"/app">) {
  const { user } = await getSession();
  if (!user) redirect("/login?next=/app");
  const [profile, stores, params] = await Promise.all([getProfile(), listMyStores(), searchParams]);
  if (!stores.length && !profile?.is_platform_admin) redirect("/app/nueva");

  const owned = stores.filter((s) => s.role === "owner").length;
  const error = typeof params.error === "string" ? params.error : null;

  const single = stores.length === 1;
  const canCreate = owned < MAX_STORES || Boolean(profile?.is_platform_admin);

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={Boolean(profile?.is_platform_admin)} section="app" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={cn(DISPLAY, "text-[28px] leading-tight font-semibold tracking-[-0.02em]")}>Mis tiendas</h1>
            <p className="mt-1 text-sm text-adm-fg-muted">
              {single ? "Entrá al panel o compartí el link de tu tienda." : "Elegí cuál administrar."}{" "}
              <span className="tnum">
                {owned} de {MAX_STORES} tiendas propias.
              </span>
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/app/nueva"
              className="inline-flex h-11 items-center gap-1.5 rounded-adm border border-adm-input-border bg-adm-surface px-3.5 text-sm font-medium text-adm-fg hover:bg-adm-hover sm:h-9"
            >
              <Plus className="size-4" strokeWidth={1.75} aria-hidden />
              Crear otra tienda
            </Link>
          ) : null}
        </div>

        {error ? <FormAlert className="mt-4">{error}</FormAlert> : null}

        {stores.length ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => {
              const chip = planChipFor(s);
              const url = storeHref(s);
              return (
                <li key={s.id} className="flex flex-col rounded-adm border border-adm-border bg-adm-surface p-5 shadow-adm-card">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em]">{s.name}</h2>
                    <Badge tone={chip.tone === "trial" ? "amber" : chip.tone === "warning" ? "red" : "accent"}>{chip.label}</Badge>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tnum mt-1 inline-flex min-h-8 w-fit max-w-full items-center gap-1 truncate text-[13px] text-adm-fg-muted underline-offset-2 hover:text-adm-fg hover:underline"
                  >
                    <span className="truncate">{storeDisplayHost(s)}</span>
                    <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                    <span className="sr-only">(abre la tienda en otra pestaña)</span>
                  </a>
                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <div>
                      <dt className="sr-only">Tu rol</dt>
                      <dd className="text-adm-fg-muted">{ROLE_LABELS[s.role]}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Estado</dt>
                      <dd>
                        {!s.is_active ? (
                          <span className="text-adm-danger">Acceso pausado</span>
                        ) : s.status === "active" ? (
                          <span className="text-adm-success">Publicada</span>
                        ) : (
                          <span className="text-adm-warning">{s.status === "suspended" ? "Suspendida" : s.status}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                    <form action={enterStore} className="min-w-[10rem] flex-1">
                      <input type="hidden" name="storeId" value={s.id} />
                      <SubmitButton
                        variant={single ? "primary" : "secondary"}
                        className="h-11 w-full sm:h-9"
                        disabled={!s.is_active}
                        pendingText="Entrando…"
                      >
                        Entrar al panel
                      </SubmitButton>
                    </form>
                    {s.status === "active" ? <CopyText text={url} label="Copiar link" ariaLabel={`Copiar el link de ${s.name}`} size="md" /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-8 max-w-[560px] rounded-adm border border-adm-border bg-adm-surface px-6 py-8">
            <h2 className="text-base font-semibold">Todavía no sos parte de ninguna tienda</h2>
            <p className="mt-1 text-sm text-adm-fg-muted">Creá la tuya: nombre, rubro y WhatsApp, en dos pasos. O entrá a una tienda desde Plataforma.</p>
            <Link
              href="/app/nueva"
              className="mt-5 inline-flex h-11 items-center rounded-adm bg-adm-accent px-4 text-[15px] font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
            >
              Crear tu tienda
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
