import { CreditCard } from "lucide-react";
import type { Metadata } from "next";

import { PlanCards, PlanComparison } from "@/components/platform/PlanCards";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { LIMITS, trialDaysLeft, type LimitKey } from "@/lib/plans";
import { listPublicPlans, planPriceLabel } from "@/lib/plans/catalog";
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

function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max === null ? 0 : max === 0 ? 100 : Math.min(100, Math.round((used / max) * 100));
  const full = max !== null && used >= max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span>{label}</span>
        <span className="tnum text-adm-fg-muted">
          <span className={cn("font-medium", full ? "text-adm-accent-2-ink" : "text-adm-fg")}>{used.toLocaleString("es-AR")}</span>
          {max === null ? " · sin límite" : ` de ${max.toLocaleString("es-AR")}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-adm-surface-2">
        {max !== null ? <div className={cn("h-full rounded-full", full ? "bg-adm-accent-2" : "bg-adm-accent")} style={{ width: `${pct}%` }} /> : null}
      </div>
    </div>
  );
}

const GRACE_MS = 7 * 86_400_000;

/** Aviso al volver del checkout de MercadoPago (`back_url` = /admin/plan?mp=ok). */
function ReturnNotice({ mp, billing, planName }: { mp: string | undefined; billing: BillingView | null; planName: string }) {
  if (mp !== "ok" && mp !== "error") return null;
  if (mp === "error") {
    return (
      <p role="status" className="mb-4 rounded-adm bg-adm-danger-soft px-3 py-2 text-[13px]">
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
    <p role="status" className="mb-4 rounded-adm bg-adm-accent-soft px-3 py-2 text-[13px]">
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
  const price = planPriceLabel(plan);
  const hasWhatsApp = Boolean(process.env.PLATFORM_WHATSAPP);
  const isOwner = ctx.membership.role === "owner" && !ctx.membership.impersonating;
  const mpState = billing?.state ?? "none";
  // Con una suscripción de MP cobrando, para cambiar de plan primero se cancela la renovación.
  const mpLocked = mpState === "active" || mpState === "past_due";
  const canPayWithMp = (code: string) => Boolean(billing?.enabled && isOwner && !mpLocked && billing.payablePlans.includes(code));
  const anyMp = plans.some((p) => canPayWithMp(p.code));
  const periodEnd = billing?.currentPeriodEnd ?? plan.currentPeriodEnd;
  const pendingPlan = billing?.providerPlanCode ? (plans.find((p) => p.code === billing.providerPlanCode)?.name ?? null) : null;
  const mp = typeof query.mp === "string" ? query.mp : undefined;
  const awaitingFirstCharge = mpState === "active" && billing?.providerStatus === AUTHORIZED_UNPAID;
  // Se puede pagar el MISMO plan en prueba (para quedárselo) o con la renovación cancelada (para seguir).
  const canRenewSamePlan = plan.status === "trialing" || mpState === "cancelling";
  const payerEmail = ctx.user.email ?? null;

  return (
    <>
      <PageHeader
        title="Plan"
        section="system"
        icon={<CreditCard />}
        description={`${ctx.store.name} · ${plan.name} · ${STATUS_TEXT[plan.status] ?? plan.status}`}
      />

      <ReturnNotice mp={mp} billing={billing} planName={plan.name} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader title={`Plan ${plan.name}`} description={plan.status === "trialing" ? "Prueba gratuita con todas las funciones de este plan." : undefined} />
          <CardBody className="space-y-3 text-sm">
            <p className="flex items-baseline gap-1.5">
              <span className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em]">{price.amount}</span>
              {price.suffix ? <span className="text-[13px] text-adm-fg-muted">{price.suffix}</span> : null}
            </p>
            {plan.status === "trialing" && plan.trialEndsAt ? (
              <p className="rounded-adm bg-adm-accent-2-soft px-3 py-2 text-[13px]">
                Te {days === 1 ? "queda 1 día" : `quedan ${days} días`} de prueba (hasta el {formatDate(plan.trialEndsAt)}). Si no elegís un plan, la
                tienda pasa a Free: no se borra nada, pero lo que excede Free queda bloqueado.
              </p>
            ) : null}
            {plan.status === "past_due" && mpState === "past_due" ? (
              <p className="rounded-adm bg-adm-danger-soft px-3 py-2 text-[13px]">
                MercadoPago no pudo cobrar el plan. Revisá el medio de pago en la sección Suscripciones de tu cuenta de MercadoPago: reintenta el
                cobro solo.
                {periodEnd ? ` Si no entra, el ${formatDate(new Date(new Date(periodEnd).getTime() + GRACE_MS))} la tienda pasa a Free.` : ""}
              </p>
            ) : plan.status === "past_due" ? (
              <p className="rounded-adm bg-adm-danger-soft px-3 py-2 text-[13px]">Tenemos un pago pendiente. Escribinos para regularizarlo.</p>
            ) : null}
            {awaitingFirstCharge ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-adm-fg-muted">
                  Tu plan está activo: MercadoPago autorizó el débito automático y el primer cobro se acredita en los próximos días.
                  {periodEnd ? ` Si no entra antes del ${formatDate(periodEnd)}, la tienda vuelve a Free.` : ""}
                </p>
                {isOwner ? <CancelRenewalButton planName={plan.name} until={periodEnd ? formatDate(periodEnd) : null} /> : null}
              </div>
            ) : mpState === "active" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-adm-fg-muted">
                  Se cobra con MercadoPago{periodEnd ? `. Próximo cobro: ${formatDate(periodEnd)}` : ""}.
                </p>
                {isOwner ? <CancelRenewalButton planName={plan.name} until={periodEnd ? formatDate(periodEnd) : null} /> : null}
              </div>
            ) : mpState === "cancelling" ? (
              <p className="rounded-adm bg-adm-accent-2-soft px-3 py-2 text-[13px]">
                Cancelaste la renovación: seguís con {plan.name}
                {periodEnd ? ` hasta el ${formatDate(periodEnd)}` : " hasta el final del período pago"}. Después la tienda pasa a Free sin borrar
                nada. Si cambiaste de idea, volvé a suscribirte abajo: MercadoPago cobra desde que lo autorizás.
              </p>
            ) : mpState === "pending" ? (
              <p className="rounded-adm bg-adm-surface-2 px-3 py-2 text-[13px]">
                Empezaste el pago{pendingPlan ? ` de ${pendingPlan}` : ""} con MercadoPago. Si ya lo completaste, se activa apenas MercadoPago lo
                confirme; si no, podés volver a intentarlo abajo.
              </p>
            ) : plan.currentPeriodEnd ? (
              <p className="text-adm-fg-muted">Período actual hasta el {formatDate(plan.currentPeriodEnd)}.</p>
            ) : null}
            {mpState === "past_due" && isOwner ? (
              <div className="flex justify-end">
                <CancelRenewalButton planName={plan.name} until={null} pastDue />
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Uso" description="Lo que usa hoy tu tienda contra los límites del plan." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {usage.map(([key, used]) => (
              <UsageBar key={key} label={LIMITS[key].label} used={used} max={plan.limits[key]} />
            ))}
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-[15px] font-semibold">Cambiar de plan</h2>
      <p className="mb-4 max-w-2xl text-[13px] text-adm-fg-muted">
        {anyMp
          ? `Pagá con MercadoPago (tarjeta o dinero en cuenta, se renueva solo cada mes y lo cancelás cuando quieras) y el plan se activa apenas MercadoPago lo confirma. Entrá a MercadoPago con la cuenta de ${payerEmail ?? "tu email de Ecommy"}: el débito automático queda a nombre de ese email. Si preferís, pedilo por WhatsApp.`
          : mpLocked && billing?.enabled
            ? "Tu plan se cobra con MercadoPago. Para pasar a otro, cancelá la renovación arriba y después pagá el nuevo, o pedilo por WhatsApp."
            : hasWhatsApp
              ? "Elegí el plan y te abrimos WhatsApp con el pedido armado: lo activamos en el día."
              : "Elegí el plan y registramos el pedido: te contactamos para activarlo."}
      </p>
      <PlanCards
        plans={plans}
        current={plan.code}
        highlight={plan.code === "pro" ? undefined : "pro"}
        renderCta={(p) => {
          const mpHere = canPayWithMp(p.code);
          if (p.code === plan.code && !(canRenewSamePlan && mpHere)) {
            return (
              <p className="text-center text-[13px] text-adm-fg-muted">{plan.status === "trialing" ? "Estás probando este plan" : "Es tu plan actual"}</p>
            );
          }
          if (p.code === plan.code) {
            // En prueba: pagar el mismo plan para quedárselo. Renovación cancelada: volver a suscribirse.
            const trial = plan.status === "trialing";
            return (
              <div className="space-y-2">
                <MercadoPagoButton plan={p.code} primary label={trial ? undefined : "Volver a suscribirme"} />
                <p className="text-center text-xs text-adm-fg-muted">{trial ? "Estás probando este plan" : "Cancelaste la renovación de este plan"}</p>
              </div>
            );
          }
          if (!mpHere) {
            return <UpgradeButton plan={p.code} label={p.code === "business" ? "Hablemos" : `Quiero ${p.name}`} primary={p.code === "pro"} />;
          }
          return (
            <div className="space-y-2">
              <MercadoPagoButton plan={p.code} primary={p.code === "pro"} />
              <UpgradeButton plan={p.code} label="Pedir por WhatsApp" />
            </div>
          );
        }}
      />

      <h2 className="mt-8 mb-3 text-[15px] font-semibold">Comparación completa</h2>
      <PlanComparison plans={plans} />
    </>
  );
}
