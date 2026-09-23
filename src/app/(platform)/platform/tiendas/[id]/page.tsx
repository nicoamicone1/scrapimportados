import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { enterAsStore } from "@/app/(platform)/platform/actions";
import { platformPageGuard } from "@/app/(platform)/platform/guard";
import { AppHeader } from "@/components/platform/AppHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { mercadoPagoDebitActive } from "@/lib/billing/state";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { billingPeriodLabel, isBillingPeriod, type BillingPeriod } from "@/lib/plans/yearly";
import { ROLE_LABELS, isAdminRole } from "@/lib/auth";
import { storeDisplayHost, storeHref } from "@/lib/tenant/urls";

import { BillingPanel, type BillingPanelProps } from "./BillingPanel";
import { StoreAdminForms } from "./StoreAdminForms";

export const metadata: Metadata = { title: "Tienda · Plataforma" };
export const dynamic = "force-dynamic";

function toDateInput(iso: string | null): string {
  if (!iso) return new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

export default async function PlatformStorePage({ params }: PageProps<"/platform/tiendas/[id]">) {
  const { id } = await params;
  const { supabase, user, profile } = await platformPageGuard(`/platform/tiendas/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: store }, { data: sub }, { data: plans }, { data: members }, stats, { data: audit }] = await Promise.all([
    supabase.from("stores").select("id, slug, name, status, owner_id, custom_domain, custom_domain_verified, created_at").eq("id", id).maybeSingle(),
    supabase.from("subscriptions").select("plan_code, status, trial_ends_at, current_period_start, notes").eq("store_id", id).maybeSingle(),
    supabase.from("plans").select("code, name").order("position"),
    supabase.rpc("admin_list_users", { p_store_id: id }),
    supabase.rpc("platform_list_stores").then((r) => (r.data ?? []).find((s) => s.id === id) ?? null),
    supabase.from("audit_log").select("id, action, summary, actor_email, created_at").eq("store_id", id).order("created_at", { ascending: false }).limit(12),
  ]);
  if (!store) notFound();

  // Cobro con MercadoPago (migración 0015): si falta, el panel lo avisa.
  // Periodicidad (0019): si falta, no se muestra.
  const [billingRes, eventsRes, periodRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("provider, provider_ref, provider_status, provider_plan_code, cancel_at_period_end, last_payment_at, current_period_end")
      .eq("store_id", id)
      .maybeSingle(),
    supabase.from("billing_events").select("id, type, result, created_at").eq("store_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("subscriptions").select("billing_period, provider_billing_period").eq("store_id", id).maybeSingle(),
  ]);
  const period: BillingPeriod | null = periodRes.error ? null : isBillingPeriod(periodRes.data?.billing_period) ? periodRes.data.billing_period : "monthly";
  const providerPeriod = periodRes.error ? null : isBillingPeriod(periodRes.data?.provider_billing_period) ? periodRes.data.provider_billing_period : null;
  const b = billingRes.error ? null : billingRes.data;
  const billing: BillingPanelProps["billing"] = billingRes.error
    ? null
    : {
        provider: b?.provider ?? null,
        providerRef: b?.provider_ref ?? null,
        providerStatus: b?.provider_status ?? null,
        providerPlanCode: b?.provider_plan_code ? `${b.provider_plan_code}${providerPeriod ? ` · ${billingPeriodLabel(providerPeriod)}` : ""}` : null,
        cancelAtPeriodEnd: Boolean(b?.cancel_at_period_end),
        lastPaymentAt: b?.last_payment_at ? formatDateTime(b.last_payment_at) : null,
        currentPeriodEnd: b?.current_period_end ? formatDateTime(b.current_period_end) : null,
      };
  const billingEvents = (eventsRes.error ? [] : (eventsRes.data ?? [])).map((e) => {
    const r = e.result && typeof e.result === "object" && !Array.isArray(e.result) ? e.result : {};
    return {
      id: e.id,
      type: e.type,
      summary: typeof r.summary === "string" ? r.summary : "Sin procesar todavía",
      when: formatDateTime(e.created_at),
    };
  });

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email ?? ""} isPlatformAdmin={profile.is_platform_admin} section="platform" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-[13px] text-adm-fg-muted">
          <Link href="/platform" className="hover:underline">
            Plataforma
          </Link>{" "}
          / Tienda
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{store.name}</h1>
            <p className="mt-0.5 text-sm text-adm-fg-muted">
              {storeDisplayHost(store)} · creada el {formatDate(store.created_at)}
              {sub && period && sub.status !== "trialing" && sub.plan_code !== "free" ? ` · pago ${billingPeriodLabel(period)}` : ""}
              {stats ? ` · ${formatNumber(stats.products)} productos · ${formatNumber(stats.orders)} pedidos` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={storeHref(store)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-adm border border-adm-input-border bg-adm-surface px-3 text-sm hover:bg-adm-hover"
            >
              Ver tienda
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <form action={enterAsStore}>
              <input type="hidden" name="storeId" value={store.id} />
              <SubmitButton pendingText="Entrando…">Entrar como admin</SubmitButton>
            </form>
          </div>
        </div>

        <div className="mt-6">
          <StoreAdminForms
            storeId={store.id}
            storeName={store.name}
            plans={plans ?? []}
            current={{
              plan: sub?.plan_code ?? "free",
              status: sub?.status ?? "active",
              trialEndsAt: toDateInput(sub?.trial_ends_at ?? null),
              storeStatus: store.status,
            }}
            mercadoPagoDebit={mercadoPagoDebitActive(b)}
            period={period}
          />
        </div>

        <section className="mt-6 rounded-adm border border-adm-border bg-adm-surface">
          <h2 className="border-b border-adm-border px-4 py-2.5 text-sm font-semibold">MercadoPago</h2>
          <BillingPanel storeId={store.id} billing={billing} events={billingEvents} mpConfigured={Boolean(process.env.MP_ACCESS_TOKEN?.trim())} />
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-adm border border-adm-border bg-adm-surface">
            <h2 className="border-b border-adm-border px-4 py-2.5 text-sm font-semibold">Equipo</h2>
            <ul className="divide-y divide-adm-border text-[13px]">
              {(members ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="truncate">{m.email}</span>
                  <span className="text-adm-fg-muted">
                    {isAdminRole(m.role) ? ROLE_LABELS[m.role] : m.role}
                    {m.is_active ? "" : " · pausado"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-adm border border-adm-border bg-adm-surface">
            <h2 className="border-b border-adm-border px-4 py-2.5 text-sm font-semibold">Actividad reciente</h2>
            <ul className="divide-y divide-adm-border text-[13px]">
              {(audit ?? []).map((a) => (
                <li key={a.id} className="px-4 py-2">
                  <div>{a.summary ?? a.action}</div>
                  <div className="text-xs text-adm-fg-muted">
                    {a.actor_email ?? "sistema"} · {formatDateTime(a.created_at)}
                  </div>
                </li>
              ))}
              {!audit?.length ? <li className="px-4 py-4 text-adm-fg-muted">Sin actividad registrada.</li> : null}
            </ul>
          </section>
        </div>
        {sub?.notes ? <p className="mt-4 text-xs text-adm-fg-muted">Notas de la suscripción: {sub.notes}</p> : null}
      </main>
    </div>
  );
}
