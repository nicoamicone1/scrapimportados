import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DISPLAY, EYEBROW, H1, TEXT_LINK } from "@/components/platform/brand";
import { pickFaq, platformFaq } from "@/components/platform/faq";
import { FaqAccordion } from "@/components/platform/faq-accordion";
import { PlanCards, PlanComparison, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { exampleStoreAddress } from "@/components/platform/site";
import { getSession } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing/mercadopago";
import { cn } from "@/lib/cn";

import { plansOrEmpty } from "../_lib/public-site";
import { ArcWord, CornerArc, Rings } from "../site-shapes";
import "../site.css";

export const metadata: Metadata = {
  title: "Planes",
  description:
    "Free, Starter, Pro y Business: qué incluye cada plan de Ecommy y cuánto cuesta. Sin comisión por venta y con 14 días de Pro gratis, sin tarjeta.",
  alternates: { canonical: "/planes" },
};

export const dynamic = "force-dynamic";

/** La prueba contada como un recorrido: hoy, día 14 y después (reversión de riesgo, sin letra chica). */
function TrialPath() {
  const steps = [
    { when: "Hoy", what: "Pro completo", detail: "Todas las funciones, sin tarjeta ni datos de pago." },
    { when: "Día 14", what: "Elegís", detail: "Si te sirve, pagás el plan que quieras desde el panel." },
    { when: "Después", what: "Free, si no elegiste", detail: "No se borra nada: productos, pedidos y páginas quedan." },
  ];
  return (
    <figure className="eco-bubble relative overflow-hidden bg-eco-ink p-6 text-white [--eco-bubble-r:32px] sm:p-8">
      <Rings size={520} className="-right-40 -bottom-56 text-eco-ink-3" />
      <figcaption className="relative text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase">Cómo funciona la prueba</figcaption>
      <svg aria-hidden viewBox="0 0 300 70" className="relative mt-5 h-auto w-full overflow-visible" preserveAspectRatio="none">
        <path d="M14 58 C 80 -10, 220 -10, 286 58" fill="none" stroke="var(--eco-ink-3)" strokeWidth={3} strokeLinecap="round" />
        <path d="M14 58 C 80 -10, 220 -10, 286 58" fill="none" stroke="var(--eco-pomelo)" strokeWidth={3} strokeLinecap="round" pathLength={1} className="eco-draw" />
        <circle cx={14} cy={58} r={7} fill="var(--eco-pomelo)" />
        <circle cx={150} cy={7} r={7} fill="var(--eco-durazno)" />
        <circle cx={286} cy={58} r={7} fill="var(--eco-mist)" />
      </svg>
      <ol className="relative mt-4 grid grid-cols-3 gap-3 text-[13px] sm:gap-5">
        {steps.map((s, i) => (
          <li key={s.when} className={cn("min-w-0", i === 1 && "text-center", i === 2 && "text-right")}>
            <p className="tnum font-semibold text-eco-bruma">{s.when}</p>
            <p className={cn(DISPLAY, "mt-1 text-[15px] leading-tight sm:text-[17px]")}>{s.what}</p>
            <p className="mt-1.5 hidden leading-snug text-eco-mist sm:block">{s.detail}</p>
          </li>
        ))}
      </ol>
      <p className="relative mt-5 border-t border-eco-ink-3 pt-4 text-[14px] leading-snug text-eco-mist sm:hidden">
        Sin tarjeta. Si no elegís un plan, pasás a Free y no se borra nada.
      </p>
    </figure>
  );
}

/** Párrafo del pago anual con el ahorro de cada plan en pesos (sólo si algún plan lo tiene). */
function YearlyNote({ mercadoPago }: { mercadoPago: boolean }) {
  return (
    <p className="mt-10 max-w-[72ch] text-[14px] leading-relaxed text-adm-fg-muted">
      <span className="font-semibold text-adm-fg">Pago anual:</span> pagás el año por adelantado,{" "}
      {mercadoPago ? "por transferencia o con Mercado Pago" : "por transferencia"}, y el precio queda fijo durante los 12 meses. El ahorro de cada plan
      está en su tarjeta, en pesos. Se renueva al año.
    </p>
  );
}

export default async function PlanesPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty("planes")]);
  const start = user ? "/app/nueva" : "/registro";
  const anyYearly = plans.some((p) => p.monthlyEquivalent != null);
  const mpEnabled = billingEnabled();
  const faq = pickFaq(platformFaq({ storeAddress: exampleStoreAddress(), plans, mpEnabled }), [
    "prueba",
    "comision",
    "cambio-plan",
    "anual",
    "tarjeta",
    "varias-tiendas",
    "dominio",
    "datos",
  ]);

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <section className="relative overflow-hidden">
        <CornerArc corner="tr" size={520} className="hidden bg-eco-durazno/70 lg:block" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-12 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-14">
          <div className="eco-pop">
            <p className={EYEBROW}>Planes</p>
            <h1 className={cn(H1, "mt-4 max-w-[13ch] text-balance")}>
              Empezás con <ArcWord>todo</ArcWord>. Después elegís.
            </h1>
            <p className="mt-6 max-w-[44ch] text-[19px] leading-[1.4] sm:text-[21px]">
              Toda tienda nueva arranca con 14 días de Pro. Precios finales en pesos, por mes y por tienda.
            </p>
            <ul className="mt-7 flex flex-wrap gap-2 text-[13px] font-medium">
              {["Sin comisión por venta", "Sin tarjeta para probar", "Cambiás de plan cuando quieras"].map((t) => (
                <li key={t} className="rounded-full border border-eco-line bg-adm-surface px-3.5 py-2">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="eco-pop [--i:2]">
            <TrialPath />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-24">
        {plans.length ? null : (
          <p role="status" className="rounded-eco-lg border border-eco-line bg-adm-surface px-5 py-4 text-[15px]">
            No pudimos cargar los precios. Probá de nuevo en un rato o{" "}
            <Link href="/contacto" className={TEXT_LINK}>
              escribinos
            </Link>
            .
          </p>
        )}

        <PlanCards
          className="mt-4 xl:mt-8"
          plans={plans}
          highlight="pro"
          highlightLabel="Incluido en la prueba"
          highlightNote="14 días de Pro, sin tarjeta. Después seguís en Free y no se borra nada."
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

        {anyYearly ? <YearlyNote mercadoPago={mpEnabled} /> : null}

        <section aria-labelledby="comparar" className="mt-20 md:mt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={EYEBROW}>Comparación</p>
              <h2 id="comparar" className={cn(DISPLAY, "mt-3 scroll-mt-24 text-[30px] leading-none sm:text-[40px]")}>
                Plan por plan, sin letra chica
              </h2>
            </div>
            <p className="max-w-[40ch] text-[14px] leading-relaxed text-adm-fg-muted">
              Los límites son por tienda. Si llegás a uno, te avisamos antes y no se borra nada.
            </p>
          </div>
          <div className="mt-8">
            <PlanComparison plans={plans} highlight="pro" />
          </div>
        </section>

        <section aria-labelledby="preguntas" className="mt-20 grid gap-10 md:mt-28 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className={EYEBROW}>Preguntas</p>
            <h2 id="preguntas" className={cn(DISPLAY, "mt-3 scroll-mt-24 text-[30px] leading-none sm:text-[40px]")}>
              Antes de elegir
            </h2>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-adm-fg-muted">
              Lo que más nos preguntan sobre la prueba, los cobros y tus datos.
            </p>
            <Link href="/contacto" className={cn(TEXT_LINK, "mt-5 inline-flex min-h-11 items-center gap-1 text-[15px]")}>
              Más preguntas y contacto
              <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
          <FaqAccordion items={faq} />
        </section>
      </div>
    </PlatformPage>
  );
}
