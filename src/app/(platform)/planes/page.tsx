import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/platform/FaqList";
import { pickFaq, platformFaq } from "@/components/platform/faq";
import { PlanCards, PlanComparison, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { exampleStoreAddress } from "@/components/platform/site";
import { getSession } from "@/lib/auth";

import { plansOrEmpty } from "../_lib/public-site";

export const metadata: Metadata = {
  title: "Planes",
  description: "Free, Starter, Pro y Business: qué incluye cada plan de Ecommy y cuánto cuesta.",
};
export const dynamic = "force-dynamic";

export default async function PlanesPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty("planes")]);
  const start = user ? "/app/nueva" : "/registro";
  const faq = pickFaq(platformFaq({ storeAddress: exampleStoreAddress() }), [
    "prueba",
    "cambio-plan",
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

        <h2 id="comparar" className="mt-14 text-[20px] font-semibold">
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
