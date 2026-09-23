import type { Metadata } from "next";

import { PlanCards, PlanComparison, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { getSession } from "@/lib/auth";
import { listPublicPlans } from "@/lib/plans/catalog";

export const metadata: Metadata = {
  title: "Planes",
  description: "Free, Starter, Pro y Business: qué incluye cada plan de Ecommy y cuánto cuesta.",
};
export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "¿Qué pasa cuando termina la prueba de 14 días?",
    a: "Si no elegiste un plan pago, tu tienda pasa a Free. No se borra nada: los productos, pedidos y páginas quedan; lo que excede el plan (por ejemplo, más de 50 productos activos) queda bloqueado para crear hasta que subas de plan.",
  },
  {
    q: "¿Cobran comisión por venta?",
    a: "No. Tus clientes te pagan por transferencia o lo acuerdan con vos por WhatsApp: la plata va directo a tu cuenta.",
  },
  {
    q: "¿Puedo cambiar de plan cuando quiera?",
    a: "Sí. Desde el panel, en Plan, pedís el cambio y lo activamos en el día. El cobro automático con MercadoPago llega en la próxima versión.",
  },
  {
    q: "¿Puedo tener más de una tienda?",
    a: "Sí, hasta tres tiendas por cuenta, cada una con su plan, su equipo y su dirección.",
  },
];

export default async function PlanesPage() {
  const [{ user }, plans] = await Promise.all([getSession(), listPublicPlans()]);
  const start = user ? "/app/nueva" : "/registro";
  const whatsapp = process.env.PLATFORM_WHATSAPP;

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">Planes</h1>
        <p className="mt-2 max-w-[600px] text-[15px] text-adm-fg-muted">
          Empezás con 14 días de Pro gratis. Precios finales en pesos, por mes y por tienda.
        </p>

        <PlanCards
          className="mt-8"
          plans={plans}
          highlight="pro"
          renderCta={(plan) =>
            plan.code === "business" ? (
              <PlanCtaLink
                href={
                  whatsapp
                    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola! Quiero consultar por el plan Business de Ecommy.")}`
                    : "/registro"
                }
              >
                Hablemos
              </PlanCtaLink>
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

        <h2 id="business" className="mt-14 text-[20px] font-semibold">
          Preguntas frecuentes
        </h2>
        <dl className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="text-[14px] font-semibold">{f.q}</dt>
              <dd className="mt-1 text-[14px] leading-relaxed text-adm-fg-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </PlatformPage>
  );
}
