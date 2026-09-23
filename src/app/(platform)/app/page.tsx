import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/platform/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getProfile, getSession, listMyStores, ROLE_LABELS, type MyStore } from "@/lib/auth";
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

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={Boolean(profile?.is_platform_admin)} section="app" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Mis tiendas</h1>
            <p className="mt-1 text-sm text-adm-fg-muted">Elegí cuál administrar. Podés tener hasta {MAX_STORES} tiendas propias.</p>
          </div>
          {owned < MAX_STORES || profile?.is_platform_admin ? (
            <Link
              href="/app/nueva"
              className="inline-flex h-8 items-center gap-1.5 rounded-adm bg-adm-accent px-3 text-sm font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
            >
              <Plus className="size-4" aria-hidden />
              Crear tienda
            </Link>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-adm border border-[#efc6c0] bg-adm-danger-soft px-3 py-2 text-[13px] text-[#8f1c13]">
            {error}
          </p>
        ) : null}

        {stores.length ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => {
              const chip = planChipFor(s);
              return (
                <li key={s.id} className="flex flex-col rounded-adm border border-adm-border bg-adm-surface p-5 shadow-adm-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{s.name}</h2>
                      <p className="truncate text-[13px] text-adm-fg-muted">{storeDisplayHost(s)}</p>
                    </div>
                    <Badge tone={chip.tone === "trial" ? "amber" : chip.tone === "warning" ? "red" : "accent"}>{chip.label}</Badge>
                  </div>
                  <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
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
                  <div className="mt-5 flex items-center gap-2">
                    <form action={enterStore} className="flex-1">
                      <input type="hidden" name="storeId" value={s.id} />
                      <SubmitButton className="w-full" disabled={!s.is_active} pendingText="Entrando…">
                        Entrar al panel
                      </SubmitButton>
                    </form>
                    <a
                      href={storeHref(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-adm border border-adm-input-border px-3 text-sm hover:bg-adm-hover"
                    >
                      Ver tienda
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-8 rounded-adm border border-dashed border-adm-input-border bg-adm-surface px-6 py-10 text-sm">
            <p className="font-medium">Todavía no sos parte de ninguna tienda.</p>
            <p className="mt-1 text-adm-fg-muted">Creá la tuya o entrá a una desde Plataforma.</p>
          </div>
        )}
      </main>
    </div>
  );
}
