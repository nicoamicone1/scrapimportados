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

/** Plan de la tienda (spec §14.3): plan actual, uso vs. límites, comparación y pedido de cambio. */
export default async function PlanPage() {
  const ctx = await requireAdmin();
  const [plans, usage] = await Promise.all([
    listPublicPlans(),
    Promise.all(USAGE_KEYS.map(async (k) => [k, await countUsage(ctx, k)] as const)),
  ]);
  const { plan } = ctx;
  const days = trialDaysLeft(plan);
  const price = planPriceLabel(plan);
  const hasWhatsApp = Boolean(process.env.PLATFORM_WHATSAPP);

  return (
    <>
      <PageHeader
        title="Plan"
        section="system"
        icon={<CreditCard />}
        description={`${ctx.store.name} · ${plan.name} · ${STATUS_TEXT[plan.status] ?? plan.status}`}
      />

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
            {plan.status === "past_due" ? (
              <p className="rounded-adm bg-adm-danger-soft px-3 py-2 text-[13px]">Tenemos un pago pendiente. Escribinos para regularizarlo.</p>
            ) : null}
            {plan.currentPeriodEnd ? <p className="text-adm-fg-muted">Período actual hasta el {formatDate(plan.currentPeriodEnd)}.</p> : null}
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
        {hasWhatsApp
          ? "Elegí el plan y te abrimos WhatsApp con el pedido armado: lo activamos en el día. El cobro automático con MercadoPago llega en la próxima versión."
          : "Elegí el plan y registramos el pedido: te contactamos para activarlo."}
      </p>
      <PlanCards
        plans={plans}
        current={plan.code}
        highlight={plan.code === "pro" ? undefined : "pro"}
        renderCta={(p) =>
          p.code === plan.code ? (
            <p className="text-center text-[13px] text-adm-fg-muted">{plan.status === "trialing" ? "Estás probando este plan" : "Es tu plan actual"}</p>
          ) : (
            <UpgradeButton plan={p.code} label={p.code === "business" ? "Hablemos" : `Quiero ${p.name}`} primary={p.code === "pro"} />
          )
        }
      />

      <h2 className="mt-8 mb-3 text-[15px] font-semibold">Comparación completa</h2>
      <PlanComparison plans={plans} />
    </>
  );
}
