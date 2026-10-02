import type { Metadata } from "next";
import Link from "next/link";

import { DISPLAY, EYEBROW, TEXT_LINK } from "@/components/platform/brand";
import { FaqList } from "@/components/platform/FaqList";
import { pickFaq, platformFaq } from "@/components/platform/faq";
import { PlanCards, PlanComparison, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { exampleStoreAddress } from "@/components/platform/site";
import { getSession } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing/mercadopago";
import type { PublicPlan } from "@/lib/plans/catalog";
import { cn } from "@/lib/cn";
import { yearlyOffer } from "@/lib/plans/yearly";

import { plansOrEmpty } from "../_lib/public-site";

export const metadata: Metadata = {
  title: "Planes",
  description:
    "Free, Starter, Pro y Business: qué incluye cada plan de Ecommy y cuánto cuesta. Sin comisión por venta y con 14 días de Pro gratis, sin tarjeta.",
  alternates: { canonical: "/planes" },
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
  const mpEnabled = billingEnabled();
  const faq = pickFaq(platformFaq({ storeAddress: exampleStoreAddress(), plans, mpEnabled }), [
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
        <p className={EYEBROW}>Planes</p>
        <h1 className={cn(DISPLAY, "mt-3 max-w-[18ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[48px]")}>
          Empezás con todo. Después elegís.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] leading-snug">
          Toda tienda nueva arranca con 14 días de Pro, sin tarjeta. Si no elegís un plan pago, pasás a Free y no se borra nada.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-adm-fg-muted">
          <li>Sin comisión por venta</li>
          <li>Precios finales en pesos, por mes y por tienda</li>
          <li>Cambiás de plan cuando quieras</li>
        </ul>

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
          className="mt-10"
          plans={plans}
          highlight="pro"
          highlightLabel="Incluido en la prueba"
          renderCta={(plan) =>
            plan.code === "business" ? (
              <PlanCtaLink href="/contacto#business">Hablemos</PlanCtaLink>
            ) : (
              <PlanCtaLink href={start} primary={plan.code === "pro"}>
                {plan.code === "pro" ? "Probar Pro 14 días gratis" : "Empezar gratis"}
              </PlanCtaLink>
            )
          }
        />

        {yearlyPlans.length ? <YearlyNote yearly={yearlyPlans} mercadoPago={mpEnabled} /> : null}

        <h2 id="comparar" className={cn(DISPLAY, "scroll-mt-20 text-[26px] font-semibold tracking-[-0.02em]", yearlyPlans.length ? "mt-8" : "mt-16")}>
          Comparación completa
        </h2>
        <div className="mt-4">
          <PlanComparison plans={plans} />
        </div>

        <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
          <h2 id="preguntas" className={cn(DISPLAY, "scroll-mt-20 text-[26px] font-semibold tracking-[-0.02em]")}>
            Preguntas frecuentes
          </h2>
          <Link href="/contacto" className={cn(TEXT_LINK, "inline-flex min-h-11 items-center text-sm")}>
            Más preguntas y contacto
          </Link>
        </div>
        <FaqList className="mt-6" items={faq} />
      </div>
    </PlatformPage>
  );
}
