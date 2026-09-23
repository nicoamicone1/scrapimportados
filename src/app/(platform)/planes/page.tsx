import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/platform/FaqList";
import { pickFaq, platformFaq } from "@/components/platform/faq";
import { PlanCards, PlanComparison, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { exampleStoreAddress } from "@/components/platform/site";
import { getSession } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing/mercadopago";
import type { PublicPlan } from "@/lib/plans/catalog";
import { yearlyOffer } from "@/lib/plans/yearly";

import { plansOrEmpty } from "../_lib/public-site";

export const metadata: Metadata = {
  title: "Planes",
  description: "Free, Starter, Pro y Business: qué incluye cada plan de Ecommy y cuánto cuesta.",
};
export const dynamic = "force-dynamic";

/** "Starter" · "Starter y Pro" · "Starter, Pro y Business". */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Párrafo del pago anual (sólo si algún plan lo tiene; sin 0019 no aparece). */
function YearlyNote({ yearly, mercadoPago }: { yearly: PublicPlan[]; mercadoPago: boolean }) {
  const offers = new Set(yearly.map((p) => yearlyOffer(p.priceMonthly, p.priceYearly)));
  const [offer] = offers;
  const common = offers.size === 1 && offer?.startsWith("12 meses") ? offer : null;
  return (
    <p className="mt-14 max-w-[640px] text-[14px] leading-relaxed text-adm-fg-muted">
      <span className="font-medium text-adm-fg">Pago anual en {joinNames(yearly.map((p) => p.name))}</span>
      {common ? `: ${common}.` : "."} Pagás el año por adelantado, {mercadoPago ? "por transferencia o con MercadoPago" : "por transferencia"}, y ese precio queda fijo durante los 12
      meses. Se renueva al año.
    </p>
  );
}

export default async function PlanesPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty("planes")]);
  const start = user ? "/app/nueva" : "/registro";
  const yearlyPlans = plans.filter((p) => p.monthlyEquivalent != null);
  const faq = pickFaq(platformFaq({ storeAddress: exampleStoreAddress(), plans }), [
    "prueba",
    "cambio-plan",
    "anual",
    "comision",
    "varias-tiendas",
    "dominio",
    "datos",
  ]);

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">Planes</h1>
        <p className="mt-2 max-w-[600px] text-[15px] text-adm-fg-muted">
          Empezás con 14 días de Pro gratis. Precios finales en pesos, por mes y por tienda.
        </p>

        {plans.length ? null : (
          <p role="status" className="mt-8 rounded-adm border border-adm-border bg-adm-surface px-4 py-3 text-[14px]">
            No pudimos cargar los precios. Probá de nuevo en un rato o{" "}
            <Link href="/contacto" className="text-adm-accent underline underline-offset-2">
              escribinos
            </Link>
            .
          </p>
        )}

        <PlanCards
          className="mt-8"
          plans={plans}
          highlight="pro"
          renderCta={(plan) =>
            plan.code === "business" ? (
              <PlanCtaLink href="/contacto#business">Hablemos</PlanCtaLink>
            ) : (
              <PlanCtaLink href={start} primary={plan.code === "pro"}>
                {plan.code === "free" ? "Empezar gratis" : `Probar ${plan.name} 14 días`}
              </PlanCtaLink>
            )
          }
        />

        {yearlyPlans.length ? <YearlyNote yearly={yearlyPlans} mercadoPago={billingEnabled()} /> : null}

        <h2 id="comparar" className={yearlyPlans.length ? "mt-8 text-[20px] font-semibold" : "mt-14 text-[20px] font-semibold"}>
          Comparación completa
        </h2>
        <div className="mt-4">
          <PlanComparison plans={plans} />
        </div>

        <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
          <h2 id="preguntas" className="text-[20px] font-semibold">
            Preguntas frecuentes
          </h2>
          <Link href="/contacto" className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
            Más preguntas y contacto
          </Link>
        </div>
        <FaqList className="mt-6" items={faq} />
      </div>
    </PlatformPage>
  );
}
