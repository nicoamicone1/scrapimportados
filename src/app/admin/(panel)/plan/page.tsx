import { CreditCard, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";

import { ProgressArc } from "@/components/admin/dashboard/ProgressArc";
import { PlanCards, PlanComparison } from "@/components/platform/PlanCards";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { LIMITS, trialDaysLeft, type LimitKey } from "@/lib/plans";
import { listPublicPlans, planPriceLabel, type PublicPlan } from "@/lib/plans/catalog";
import { billingPeriodLabel, monthlyEquivalent, planWithPeriod, type BillingPeriod } from "@/lib/plans/yearly";
import { formatMoney } from "@/lib/money";
import { countUsage } from "@/lib/plans/server";
import { AUTHORIZED_UNPAID } from "@/lib/billing/state";
import { loadBillingView, type BillingView } from "@/lib/billing/view";

import { CancelRenewalButton } from "./CancelRenewalButton";
import { MercadoPagoButton } from "./MercadoPagoButton";
import { UpgradeButton } from "./UpgradeButton";

export const metadata: Metadata = { title: "Plan" };

const USAGE_KEYS = ["products", "pages", "staff", "promotions", "coupons", "import_jobs_month"] as const satisfies readonly LimitKey[];

const STATUS_TEXT: Record<string, string> = {
  active: "Activo",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  cancelled: "Cancelado",
};

/** Uso contra el límite en el arco de la marca (BRAND §7.2); desde el 80 % se tiñe de pomelo. */
function UsageArc({ label, used, max }: { label: string; used: number; max: number | null }) {
  const full = max !== null && used >= max;
  const near = !full && max !== null && max > 0 && used / max >= 0.8;
  const pct = max === null ? 0 : max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
  const usedText = used.toLocaleString("es-AR");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProgressArc
        value={max === null ? 0 : Math.min(used, max)}
        max={max === null ? 1 : Math.max(max, 1)}
        size={52}
        stroke={6}
        tone={full || near ? "pomelo" : "ink"}
        label={max === null ? `${label}: ${usedText}, sin límite` : `${label}: ${usedText} de ${max.toLocaleString("es-AR")}`}
      >
        <span className="tnum text-[11px] font-semibold text-adm-fg">{max === null ? "∞" : `${pct}%`}</span>
      </ProgressArc>
      <div className="min-w-0">
        <p className="truncate text-[13px] text-adm-fg-muted">{label}</p>
        <p className="tnum text-[13px]">
          <span className={cn("eco-num text-[17px]", full || near ? "text-adm-accent-2-ink" : "text-adm-fg")}>{usedText}</span>
          <span className="text-adm-fg-muted">{max === null ? " · sin límite" : ` de ${max.toLocaleString("es-AR")}`}</span>
        </p>
        {full || near ? <p className="text-xs font-medium text-adm-accent-2-ink">{full ? "Llegaste al límite del plan." : "Cerca del límite."}</p> : null}
      </div>
    </div>
  );
}

const GRACE_MS = 7 * 86_400_000;

/** "Pagar el año (ahorrás 17 %)" · "Pagar el año". */
function yearlyLabel(p: PublicPlan, prefix: string): string {
  return p.yearlySavingsPercent ? `${prefix} (ahorrás ${p.yearlySavingsPercent}\u00a0%)` : prefix;
}

/**
 * Botones de MercadoPago de un plan: "Pagar mensual" y "Pagar el año
 * (ahorrás N %)" si tiene los dos; si tiene uno solo, ese.
 */
function MercadoPagoButtons(props: { p: PublicPlan; monthly: boolean; yearly: boolean; primary: boolean; renewLabel?: string }) {
  const { p, monthly, yearly, primary, renewLabel } = props;
  return (
    <>
      {monthly ? <MercadoPagoButton plan={p.code} period="monthly" primary={primary} label={yearly ? "Pagar mensual" : renewLabel} /> : null}
      {yearly ? (
        <MercadoPagoButton
          plan={p.code}
          period="yearly"
          primary={primary && !monthly}
          label={yearlyLabel(p, monthly ? "Pagar el año" : "Pagar el año con MercadoPago")}
        />
      ) : null}
    </>
  );
}

/** Aviso al volver del checkout de MercadoPago (`back_url` = /admin/plan?mp=ok). */
function ReturnNotice({ mp, billing, planName }: { mp: string | undefined; billing: BillingView | null; planName: string }) {
  if (mp !== "ok" && mp !== "error") return null;
  if (mp === "error") {
    return (
      <p role="status" className="mb-4 rounded-adm-lg bg-adm-danger-soft px-3 py-2 text-[13px]">
        El pago en MercadoPago no se completó y tu plan no cambió. Podés intentarlo de nuevo o pedir el plan por WhatsApp.
      </p>
    );
  }
  const text =
    billing?.state === "active"
      ? billing.providerStatus === AUTHORIZED_UNPAID
        ? `Listo: MercadoPago autorizó el débito automático y tu plan ${planName} está activo. El primer cobro se acredita en los próximos días; te avisamos por mail.`
        : `Listo: MercadoPago confirmó el cobro y tu plan ${planName} está activo. Te avisamos por mail.`
      : "Volviste de MercadoPago. Cuando confirme el pago (suele tardar unos minutos) activamos el plan y te avisamos por mail; no hace falta que pagues de nuevo.";
  return (
    <p role="status" className="mb-4 rounded-adm-lg bg-adm-accent-soft px-3 py-2 text-[13px]">
      {text}
    </p>
  );
}

/** Plan de la tienda (spec §14.3): plan actual, uso vs. límites, comparación y cambio (MercadoPago o WhatsApp). */
export default async function PlanPage({ searchParams }: PageProps<"/admin/plan">) {
  const ctx = await requireAdmin();
  const [plans, usage, billing, query] = await Promise.all([
    listPublicPlans(),
    Promise.all(USAGE_KEYS.map(async (k) => [k, await countUsage(ctx, k)] as const)),
    loadBillingView(ctx.supabase, ctx.store.id),
    searchParams,
  ]);
  const { plan } = ctx;
  const days = trialDaysLeft(plan);
  const price = planPriceLabel(plan, plan.billingPeriod);
  const yearlyNow = plan.billingPeriod === "yearly";
  // "Pro" · "Pro anual" (Free y la prueba son siempre mensuales).
  const planLabel = planWithPeriod(plan.name, plan.billingPeriod);
  const hasWhatsApp = Boolean(process.env.PLATFORM_WHATSAPP);
  const isOwner = ctx.membership.role === "owner" && !ctx.membership.impersonating;
  const mpState = billing?.state ?? "none";
  // Con una suscripción de MP cobrando, para cambiar de plan primero se cancela la renovación.
  const mpLocked = mpState === "active" || mpState === "past_due";
  const canPayWithMp = (code: string, period: BillingPeriod = "monthly") =>
    Boolean(billing?.enabled && isOwner && !mpLocked && (period === "yearly" ? billing.payableYearly : billing.payablePlans).includes(code));
  const anyMp = plans.some((p) => canPayWithMp(p.code) || canPayWithMp(p.code, "yearly"));
  const anyYearlyMp = plans.some((p) => canPayWithMp(p.code, "yearly"));
  const periodEnd = billing?.currentPeriodEnd ?? plan.currentPeriodEnd;
  const pendingName = billing?.providerPlanCode ? (plans.find((p) => p.code === billing.providerPlanCode)?.name ?? null) : null;
  const pendingPlan = pendingName ? planWithPeriod(pendingName, billing?.providerBillingPeriod ?? "monthly") : null;
  const mp = typeof query.mp === "string" ? query.mp : undefined;
  const awaitingFirstCharge = mpState === "active" && billing?.providerStatus === AUTHORIZED_UNPAID;
  // Se puede pagar el MISMO plan en prueba (para quedárselo) o con la renovación cancelada (para seguir).
  const canRenewSamePlan = plan.status === "trialing" || mpState === "cancelling";
  const payerEmail = ctx.user.email ?? null;
  // Lo más cerca del límite va primero; desde el 80 % se avisa arriba (BRAND §10).
  const ratio = (k: (typeof USAGE_KEYS)[number], used: number) => {
    const max = plan.limits[k];
    return max === null ? -1 : max === 0 ? 2 : used / max;
  };
  const usageSorted = [...usage].sort((a, b) => ratio(b[0], b[1]) - ratio(a[0], a[1]));
  const [topKey, topUsed] = usageSorted[0] ?? [];
  const topMax = topKey ? plan.limits[topKey] : null;
  const limitNotice =
    topKey && topMax !== null && topMax > 0 && topUsed !== undefined && topUsed / topMax >= 0.8
      ? topUsed >= topMax
        ? `Llegaste al límite de ${LIMITS[topKey].unit} del plan ${planLabel}: ${topUsed.toLocaleString("es-AR")} de ${topMax.toLocaleString("es-AR")}. Lo que ya cargaste sigue ahí; para sumar más, cambiá de plan.`
        : `Usaste ${topUsed.toLocaleString("es-AR")} de ${topMax.toLocaleString("es-AR")} ${LIMITS[topKey].unit} del plan ${planLabel}.`
      : null;

  return (
    <>
      <PageHeader
        title="Plan"
        section="system"
        icon={<CreditCard />}
        description={`${ctx.store.name} · ${planLabel} · ${STATUS_TEXT[plan.status] ?? plan.status}`}
        actions={
          <ButtonLink href="#cambiar-plan" variant="secondary" className="max-sm:h-11">
            Ver planes
          </ButtonLink>
        }
      />

      {limitNotice ? (
        <p role="status" className="mb-4 flex items-start gap-2.5 rounded-adm-lg bg-adm-accent-2-soft px-4 py-3 text-[13px] text-adm-fg">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-adm-accent-2-ink" aria-hidden />
          <span>
            {limitNotice}{" "}
            <a href="#cambiar-plan" className="font-medium text-adm-link underline decoration-2 underline-offset-4">
              Ver planes
            </a>
          </span>
        </p>
      ) : null}

      <ReturnNotice mp={mp} billing={billing} planName={planLabel} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* El plan actual: la hoja tinta protagonista (BRAND §7.2). */}
        <section aria-labelledby="plan-actual" className="flex flex-col overflow-hidden rounded-adm-lg border border-adm-border bg-adm-surface shadow-adm-card">
          <div className="relative isolate flex min-h-52 flex-1 flex-col overflow-hidden bg-eco-ink px-5 pt-5 pb-6 text-white sm:px-6">
            <svg aria-hidden viewBox="0 0 200 200" className="absolute -right-20 -bottom-24 -z-10 size-72">
              <circle cx="100" cy="100" r="86" fill="none" stroke="var(--eco-ink-3)" strokeWidth="2" />
              <circle cx="100" cy="100" r="66" fill="none" stroke="var(--eco-ink-3)" strokeWidth="2" />
              <circle cx="100" cy="100" r="44" fill="none" stroke="var(--eco-pomelo)" strokeWidth="14" />
            </svg>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-eco-bruma uppercase">Tu plan</p>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-eco-ink-2 px-2.5 text-xs font-medium text-eco-mist ring-1 ring-eco-ink-3">
                <span aria-hidden className={cn("size-1.5 rounded-full", plan.status === "past_due" ? "bg-adm-danger-on-dark" : "bg-eco-pomelo")} />
                {STATUS_TEXT[plan.status] ?? plan.status}
              </span>
            </div>
            <h2 id="plan-actual" className="eco-display mt-3 text-[34px] leading-none text-white">
              {planLabel}
            </h2>
            {plan.status === "trialing" ? <p className="mt-2 text-[13px] text-eco-mist">Prueba gratuita con todas las funciones de este plan.</p> : null}
            <ul className="mt-4 flex max-w-[30ch] flex-col gap-1.5 text-[13px] text-eco-mist" aria-label="Lo principal del plan">
              {(["products", "staff", "images_per_product"] as const).map((k) => {
                const max = plan.limits[k];
                return (
                  <li key={k} className="flex items-center gap-2">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-eco-pomelo" />
                    {max === null ? `${LIMITS[k].label} sin límite` : `Hasta ${max.toLocaleString("es-AR")} ${LIMITS[k].unit}${k === "images_per_product" ? " por producto" : ""}`}
                  </li>
                );
              })}
            </ul>
            <p className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-6">
              <span className="eco-num text-[34px] leading-none text-white">{price.amount}</span>
              {price.suffix ? <span className="text-[13px] text-eco-bruma">{price.suffix}</span> : null}
              {yearlyNow && plan.priceYearly ? (
                <span className="tnum text-[13px] text-eco-bruma">
                  · {formatMoney(monthlyEquivalent(plan.priceYearly), { currency: plan.currency })} por mes
                </span>
              ) : null}
            </p>
          </div>
          <div className="space-y-3 p-4 text-sm empty:hidden sm:px-5">
            {plan.status === "trialing" && plan.trialEndsAt ? (
              <p className="rounded-adm-lg bg-adm-accent-2-soft px-3 py-2 text-[13px]">
                Te {days === 1 ? "queda 1 día" : `quedan ${days} días`} de prueba (hasta el {formatDate(plan.trialEndsAt)}). Si no elegís un plan, la
                tienda pasa a Free: no se borra nada, pero lo que excede Free queda bloqueado.
              </p>
            ) : null}
            {plan.status === "past_due" && mpState === "past_due" ? (
              <p className="rounded-adm-lg bg-adm-danger-soft px-3 py-2 text-[13px]">
                MercadoPago no pudo cobrar el plan. Revisá el medio de pago en la sección Suscripciones de tu cuenta de MercadoPago: reintenta el
                cobro solo.
                {periodEnd ? ` Si no entra, el ${formatDate(new Date(new Date(periodEnd).getTime() + GRACE_MS))} la tienda pasa a Free.` : ""}
              </p>
            ) : plan.status === "past_due" ? (
              <p className="rounded-adm-lg bg-adm-danger-soft px-3 py-2 text-[13px]">Tenemos un pago pendiente. Escribinos para regularizarlo.</p>
            ) : null}
            {awaitingFirstCharge ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-adm-fg-muted">
                  Tu plan está activo: MercadoPago autorizó el débito automático y el primer cobro se acredita en los próximos días.
                  {periodEnd ? ` Si no entra antes del ${formatDate(periodEnd)}, la tienda vuelve a Free.` : ""}
                </p>
                {isOwner ? <CancelRenewalButton planName={planLabel} until={periodEnd ? formatDate(periodEnd) : null} /> : null}
              </div>
            ) : mpState === "active" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-adm-fg-muted">
                  Plan {plan.name} {billingPeriodLabel(plan.billingPeriod)} con MercadoPago
                  {periodEnd ? ` · próximo cobro el ${formatDate(periodEnd)}` : ""}.
                </p>
                {isOwner ? <CancelRenewalButton planName={planLabel} until={periodEnd ? formatDate(periodEnd) : null} /> : null}
              </div>
            ) : mpState === "cancelling" ? (
              <p className="rounded-adm-lg bg-adm-accent-2-soft px-3 py-2 text-[13px]">
                Cancelaste la renovación: seguís con {planLabel}
                {periodEnd ? ` hasta el ${formatDate(periodEnd)}` : " hasta el final del período pago"}. Después la tienda pasa a Free sin borrar
                nada. Si cambiaste de idea, volvé a suscribirte abajo: MercadoPago cobra desde que lo autorizás.
              </p>
            ) : mpState === "pending" ? (
              <p className="rounded-adm-lg bg-adm-surface-2 px-3 py-2 text-[13px]">
                Empezaste el pago{pendingPlan ? ` de ${pendingPlan}` : ""} con MercadoPago. Si ya lo completaste, se activa apenas MercadoPago lo
                confirme; si no, podés volver a intentarlo abajo.
              </p>
            ) : plan.currentPeriodEnd ? (
              <p className="text-adm-fg-muted">
                {yearlyNow ? `Plan ${planLabel} · período pago` : "Período actual"} hasta el {formatDate(plan.currentPeriodEnd)}.
              </p>
            ) : yearlyNow ? (
              <p className="text-adm-fg-muted">Plan {planLabel}: pagás el año por adelantado.</p>
            ) : null}
            {mpState === "past_due" && isOwner ? (
              <div className="flex justify-end">
                <CancelRenewalButton planName={planLabel} until={null} pastDue />
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="uso-title" className="rounded-adm-lg border border-adm-border bg-adm-surface p-4 shadow-adm-card sm:p-5">
          <h2 id="uso-title" className="text-[15px] font-semibold text-adm-fg">
            Uso
          </h2>
          <p className="mt-0.5 text-[13px] text-adm-fg-muted">Lo que usa hoy tu tienda contra los límites del plan.</p>
          <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {usageSorted.map(([key, used]) => (
              <UsageArc key={key} label={LIMITS[key].label} used={used} max={plan.limits[key]} />
            ))}
          </div>
        </section>
      </div>

      <h2 id="cambiar-plan" className="eco-display mt-10 mb-2 scroll-mt-20 text-[20px] leading-6">
        Cambiar de plan
      </h2>
      <p className="mb-2 max-w-2xl text-[13px] text-adm-fg-muted">
        {anyMp
          ? "Pagá con MercadoPago y el plan se activa apenas lo confirma. Lo cancelás cuando quieras. También podés pedirlo por WhatsApp."
          : mpLocked && billing?.enabled
            ? "Tu plan se cobra con MercadoPago. Para pasar a otro, cancelá la renovación arriba y después pagá el nuevo, o pedilo por WhatsApp."
            : hasWhatsApp
              ? "Elegí el plan y te abrimos WhatsApp con el pedido armado: lo activamos en el día."
              : "Elegí el plan y registramos el pedido: te contactamos para activarlo."}
      </p>
      {anyMp ? (
        <details className="mb-4 max-w-2xl text-[13px] text-adm-fg-muted">
          <summary className="inline-flex min-h-8 cursor-pointer items-center text-adm-link underline underline-offset-2 max-sm:min-h-11">
            Cómo funciona el cobro
          </summary>
          <p className="mt-1">
            Con tarjeta o dinero en cuenta; se renueva solo {anyYearlyMp ? "cada mes o cada año, según elijas" : "cada mes"}.
            {anyYearlyMp ? " Pagando el año, el precio queda fijo 12 meses." : ""} Entrá a MercadoPago con la cuenta de{" "}
            {payerEmail ?? "tu email de Ecommy"}: el débito automático queda a nombre de ese email.
          </p>
        </details>
      ) : (
        <div className="mb-4" />
      )}
      <PlanCards
        plans={plans}
        current={plan.code}
        highlight={plan.code === "pro" ? undefined : "pro"}
        renderCta={(p) => {
          const mpMonthly = canPayWithMp(p.code);
          const mpYearly = canPayWithMp(p.code, "yearly");
          const mpHere = mpMonthly || mpYearly;
          // El plan tiene pago anual (0019): el pedido por WhatsApp dice qué periodicidad eligió.
          const hasYearly = p.monthlyEquivalent != null;
          if (p.code === plan.code && !(canRenewSamePlan && mpHere)) {
            // Plan mensual vigente (sin débito de MP cobrando) que tiene anual: pedir el cambio a anual.
            const toYearly = hasYearly && !yearlyNow && plan.status === "active" && !mpLocked && mpState !== "cancelling";
            return (
              <div className="space-y-1 text-center">
                <p className="text-[13px] text-adm-fg-muted">{plan.status === "trialing" ? "Estás probando este plan" : "Es tu plan actual"}</p>
                {toYearly ? <UpgradeButton plan={p.code} period="yearly" variant="link" label={yearlyLabel(p, "Pasar al pago anual")} /> : null}
              </div>
            );
          }
          if (p.code === plan.code) {
            // En prueba: pagar el mismo plan para quedárselo. Renovación cancelada: volver a suscribirse.
            const trial = plan.status === "trialing";
            return (
              <div className="space-y-2">
                <MercadoPagoButtons p={p} monthly={mpMonthly} yearly={mpYearly} primary renewLabel={trial ? undefined : "Volver a suscribirme"} />
                <p className="text-center text-xs text-adm-fg-muted">{trial ? "Estás probando este plan" : "Cancelaste la renovación de este plan"}</p>
              </div>
            );
          }
          if (!mpHere) {
            if (p.code === "business") return <UpgradeButton plan={p.code} label="Hablemos" />;
            return (
              <div className="space-y-1.5 text-center">
                <UpgradeButton plan={p.code} period={hasYearly ? "monthly" : undefined} label={`Quiero ${p.name}`} primary={p.code === "pro"} />
                {hasYearly ? <UpgradeButton plan={p.code} period="yearly" variant="link" label={yearlyLabel(p, "Pedir el año")} /> : null}
              </div>
            );
          }
          return (
            <div className="space-y-2">
              <MercadoPagoButtons p={p} monthly={mpMonthly} yearly={mpYearly} primary={p.code === "pro"} />
              {hasYearly ? (
                <p className="text-center text-[13px] text-adm-fg-muted">
                  Por WhatsApp: <UpgradeButton plan={p.code} period="monthly" variant="link" label="mensual" /> ·{" "}
                  <UpgradeButton plan={p.code} period="yearly" variant="link" label="anual" />
                </p>
              ) : (
                <UpgradeButton plan={p.code} label="Pedir por WhatsApp" />
              )}
            </div>
          );
        }}
      />

      <h2 className="eco-display mt-10 mb-3 text-[20px] leading-6">Comparación completa</h2>
      <PlanComparison plans={plans} />
    </>
  );
}
