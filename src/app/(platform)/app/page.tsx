import { ArrowRight, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { AppHeader } from "@/components/platform/AppHeader";
import { CTA_ARROW, CTA_PRIMARY, DISPLAY, EYEBROW, FormAlert } from "@/components/platform/brand";
import { CopyText } from "@/components/platform/CopyText";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getProfile, getSession, listMyStores, ROLE_LABELS, type MyStore } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { getPlanChip } from "@/lib/plans/chip";
import { parsePlan } from "@/lib/plans";
import { storeDisplayHost, storeHref } from "@/lib/tenant/urls";

import { CornerArc } from "../site-shapes";
import { enterStore } from "./actions";
import "../site.css";

export const metadata: Metadata = { title: "Mis tiendas" };
export const dynamic = "force-dynamic";

const MAX_STORES = 3;

/** Monograma de cada tienda: una burbuja con su inicial, en las tintas de la marca. */
const TINTS = ["bg-eco-durazno text-eco-ink", "bg-eco-azul-soft text-adm-link", "bg-eco-ink text-white"] as const;

function initial(name: string): string {
  return (name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? "·").toUpperCase();
}

function planChipFor(s: MyStore) {
  const expiredTrial = s.plan_status === "trialing" && s.trial_ends_at !== null && new Date(s.trial_ends_at).getTime() < Date.now();
  const plan = parsePlan({
    code: expiredTrial ? "free" : (s.plan_code ?? "free"),
    status: expiredTrial ? "active" : (s.plan_status ?? "active"),
    trial_ends_at: expiredTrial ? null : s.trial_ends_at,
  });
  return getPlanChip({ plan });
}

function StoreStatus({ s }: { s: MyStore }) {
  const [dot, text, label] = !s.is_active
    ? ["bg-adm-danger", "text-adm-danger", "Acceso pausado"]
    : s.status === "active"
      ? ["bg-adm-success", "text-adm-success", "Publicada"]
      : ["bg-adm-warning", "text-adm-warning", s.status === "suspended" ? "Suspendida" : s.status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      <span className={text}>{label}</span>
    </span>
  );
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
  const free = Math.max(0, MAX_STORES - owned);

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={Boolean(profile?.is_platform_admin)} section="app" />
      <main className="relative overflow-hidden">
        <CornerArc corner="tr" size={460} className="hidden bg-eco-durazno/60 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 md:pt-16">
          <div className="eco-pop flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className={EYEBROW}>Tu cuenta</p>
              <h1 className={cn(DISPLAY, "mt-3 text-[40px] leading-none sm:text-[56px]")}>{single ? "Tu tienda" : "Tus tiendas"}</h1>
            </div>
            <p className="max-w-[44ch] text-[15px] leading-relaxed text-adm-fg-muted">
              {single ? "Entrá al panel o compartí el link de tu tienda." : "Elegí cuál administrar."}{" "}
              <span className="tnum font-medium text-adm-fg">
                {owned} de {MAX_STORES} tiendas propias.
              </span>
            </p>
          </div>

          {error ? <FormAlert className="mt-6">{error}</FormAlert> : null}

          {stores.length ? (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((s, i) => {
                const chip = planChipFor(s);
                const url = storeHref(s);
                return (
                  <li key={s.id} className="eco-pop site-lift flex min-w-0 flex-col border border-eco-line bg-adm-surface p-6" style={{ "--i": i + 1 } as CSSProperties}>
                    <div className="flex items-start justify-between gap-3">
                      <span
                        aria-hidden
                        className={cn(DISPLAY, "flex size-14 shrink-0 items-center justify-center rounded-[20px] rounded-bl-[5px] text-[26px]", TINTS[i % TINTS.length])}
                      >
                        {initial(s.name)}
                      </span>
                      <Badge tone={chip.tone === "trial" ? "amber" : chip.tone === "warning" ? "red" : "accent"}>{chip.label}</Badge>
                    </div>
                    <h2 className={cn(DISPLAY, "mt-5 truncate text-[24px] leading-tight")}>{s.name}</h2>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tnum mt-1.5 inline-flex min-h-8 w-fit max-w-full items-center gap-1 text-[14px] text-adm-link underline decoration-1 underline-offset-[3px] hover:decoration-2"
                    >
                      <span className="truncate">{storeDisplayHost(s)}</span>
                      <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="sr-only">(abre la tienda en otra pestaña)</span>
                    </a>
                    <dl className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                      <div>
                        <dt className="sr-only">Tu rol</dt>
                        <dd className="text-adm-fg-muted">{ROLE_LABELS[s.role]}</dd>
                      </div>
                      <span aria-hidden className="size-1 rounded-full bg-adm-input-border" />
                      <div>
                        <dt className="sr-only">Estado</dt>
                        <dd>
                          <StoreStatus s={s} />
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-7">
                      <form action={enterStore} className="min-w-[10rem] flex-1">
                        <input type="hidden" name="storeId" value={s.id} />
                        <SubmitButton
                          variant={single ? "primary" : "secondary"}
                          size="lg"
                          className="h-11 w-full rounded-full text-[15px]"
                          disabled={!s.is_active}
                          pendingText="Entrando…"
                          iconRight={<ArrowRight />}
                        >
                          Entrar al panel
                        </SubmitButton>
                      </form>
                      {s.status === "active" ? <CopyText text={url} label="Copiar link" ariaLabel={`Copiar el link de ${s.name}`} size="lg" className="h-11 rounded-full px-4" /> : null}
                    </div>
                  </li>
                );
              })}
              {canCreate ? (
                <li className="eco-pop" style={{ "--i": stores.length + 1 } as CSSProperties}>
                  <Link
                    href="/app/nueva"
                    className="site-lift group flex h-full min-h-[260px] flex-col items-start justify-between border-2 border-dashed border-adm-input-border/70 p-6 hover:border-eco-ink"
                  >
                    <span
                      aria-hidden
                      className="flex size-14 items-center justify-center rounded-[20px] rounded-bl-[5px] bg-eco-pomelo text-eco-ink transition-transform duration-[420ms] ease-eco-spring group-hover:rotate-90"
                    >
                      <Plus className="size-6" strokeWidth={2} />
                    </span>
                    <span>
                      <span className={cn(DISPLAY, "block text-[24px] leading-tight")}>Crear otra tienda</span>
                      <span className="mt-1.5 block text-[14px] leading-snug text-adm-fg-muted">
                        {free === 0
                          ? "Como superadmin no tenés tope."
                          : `Te ${free === 1 ? "queda 1 lugar" : `quedan ${free} lugares`}. Nombre, rubro y WhatsApp, en dos pasos.`}
                      </span>
                    </span>
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="eco-bubble mt-10 max-w-[620px] bg-eco-durazno px-7 py-8 [--eco-bubble-r:28px]">
              <h2 className={cn(DISPLAY, "text-[26px] leading-tight")}>Todavía no sos parte de ninguna tienda</h2>
              <p className="mt-2 text-[15px] text-eco-ink">Creá la tuya: nombre, rubro y WhatsApp, en dos pasos. O entrá a una tienda desde Plataforma.</p>
              <Link href="/app/nueva" className={cn(CTA_PRIMARY, "mt-6")}>
                Crear tu tienda
                <span className={CTA_ARROW}>
                  <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                </span>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
