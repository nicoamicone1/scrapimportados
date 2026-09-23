import { ArrowRight, Landmark, Layers, MapPinned, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { CatalogMock, CheckoutMock, PricesMock, ShippingMock, StorefrontMock } from "@/components/platform/LandingMocks";
import { PlanCards, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { getSession } from "@/lib/auth";
import { listPublicPlans, type PublicPlan } from "@/lib/plans/catalog";
import { storeHref } from "@/lib/tenant/urls";

export const metadata: Metadata = { title: { absolute: "Ecommy · Tu tienda online con tu marca" } };
export const dynamic = "force-dynamic";

const FEATURES: { icon: ReactNode; title: string; text: string; mock: ReactNode }[] = [
  {
    icon: <Layers className="size-5" strokeWidth={1.5} />,
    title: "Tu catálogo, cargado en una tarde",
    text: "Productos con variantes de talle y color, fotos, stock por variante y categorías anidadas. ¿Ya tenés una planilla o una tienda en otro lado? Importala y seguís desde ahí.",
    mock: <CatalogMock />,
  },
  {
    icon: <Tags className="size-5" strokeWidth={1.5} />,
    title: "Precios que se actualizan solos",
    text: "Subí un 8 % a toda una categoría con redondeo y vista previa, y deshacelo si te equivocaste. Promos programadas por fecha y cupones con tope de usos.",
    mock: <PricesMock />,
  },
  {
    icon: <Landmark className="size-5" strokeWidth={1.5} />,
    title: "Cobrás como ya cobrás",
    text: "Sin pasarela ni comisión: transferencia con descuento o acordar por WhatsApp. El pedido queda registrado antes de derivar y te llega armado, con total y dirección.",
    mock: <CheckoutMock />,
  },
  {
    icon: <MapPinned className="size-5" strokeWidth={1.5} />,
    title: "Envíos por zona, dibujadas en el mapa",
    text: "Marcá tu zona de reparto sobre el mapa, sumá provincias o códigos postales con su costo y plazo, y ofrecé retiro en tu local. El checkout calcula el envío solo.",
    mock: <ShippingMock />,
  },
];

async function plansOrEmpty(): Promise<PublicPlan[]> {
  try {
    return await listPublicPlans();
  } catch (err) {
    console.error("[landing] planes:", err instanceof Error ? err.message : err);
    return [];
  }
}

export default async function LandingPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty()]);
  const signedIn = Boolean(user);
  const start = signedIn ? "/app/nueva" : "/registro";

  return (
    <PlatformPage signedIn={signedIn}>
      <section className="border-b border-adm-border bg-adm-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Tiendas online para vender en Argentina</p>
            <h1 className="mt-3 max-w-[560px] text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[42px]">
              Tu tienda online con tu marca, cobrando por transferencia o WhatsApp.
            </h1>
            <p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-adm-fg-muted">
              Cargá el catálogo, elegí un estilo y compartí el link. Cada pedido queda registrado y te llega por WhatsApp con el total y la
              dirección. Empezás con 14 días de Pro gratis, sin tarjeta.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={start}
                className="inline-flex h-10 items-center gap-2 rounded-adm bg-adm-accent px-4 text-sm font-medium text-adm-accent-fg hover:bg-adm-accent-hover"
              >
                Creá tu tienda gratis
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href={storeHref({ slug: "demo" })} className="text-sm font-medium text-adm-accent underline-offset-4 hover:underline">
                Mirá una tienda funcionando
              </Link>
            </div>
            <dl className="mt-10 grid max-w-[480px] grid-cols-3 border-t border-adm-border pt-5 text-[13px]">
              <div>
                <dt className="text-adm-fg-muted">Para arrancar</dt>
                <dd className="mt-0.5 font-semibold">$ 0</dd>
              </div>
              <div className="border-l border-adm-border pl-4">
                <dt className="text-adm-fg-muted">Comisión por venta</dt>
                <dd className="mt-0.5 font-semibold">Ninguna</dd>
              </div>
              <div className="border-l border-adm-border pl-4">
                <dt className="text-adm-fg-muted">Estilos de tienda</dt>
                <dd className="mt-0.5 font-semibold">10 presets</dd>
              </div>
            </dl>
          </div>
          <StorefrontMock className="w-full max-w-[520px] justify-self-center lg:justify-self-end" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <h2 className="max-w-[560px] text-[26px] leading-tight font-semibold tracking-[-0.015em]">
          Lo que hacés todos los días, en un panel pensado para eso.
        </h2>
        <div className="mt-10 space-y-12">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
              <div className={i % 2 ? "md:order-2" : undefined}>
                <h3 className="flex items-center gap-2.5 text-[17px] font-semibold">
                  <span className="text-adm-accent">{f.icon}</span>
                  {f.title}
                </h3>
                <p className="mt-2 max-w-[460px] text-[14px] leading-relaxed text-adm-fg-muted">{f.text}</p>
              </div>
              <div className={i % 2 ? "md:order-1" : undefined}>{f.mock}</div>
            </div>
          ))}
        </div>
      </section>

      {plans.length ? (
        <section id="planes" className="border-t border-adm-border bg-adm-surface-2/60">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.015em]">Planes</h2>
                <p className="mt-1 max-w-[520px] text-[14px] text-adm-fg-muted">
                  Toda tienda nueva arranca con 14 días de Pro. Después elegís: si no pagás nada, pasás a Free sin perder tus datos.
                </p>
              </div>
              <Link href="/planes" className="text-sm font-medium text-adm-accent underline-offset-4 hover:underline">
                Comparar todo en detalle
              </Link>
            </div>
            <PlanCards
              className="mt-8"
              plans={plans}
              highlight="pro"
              renderCta={(plan) =>
                plan.code === "business" ? (
                  <PlanCtaLink href="/planes#business">Hablemos</PlanCtaLink>
                ) : (
                  <PlanCtaLink href={start} primary={plan.code === "pro"}>
                    {plan.code === "free" ? "Empezar gratis" : `Probar ${plan.name} 14 días`}
                  </PlanCtaLink>
                )
              }
            />
          </div>
        </section>
      ) : null}

      <section className="border-t border-adm-border bg-adm-sidebar-bg text-adm-sidebar-fg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <p className="max-w-[560px] text-[22px] leading-snug font-semibold tracking-[-0.01em]">
            En diez minutos tenés la tienda armada. Lo que falta es tu primera venta.
          </p>
          <Link
            href={start}
            className="inline-flex h-10 items-center gap-2 rounded-adm bg-adm-accent-2 px-4 text-sm font-medium text-adm-accent-2-fg hover:bg-adm-accent-2-hover"
          >
            Creá tu tienda gratis
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </PlatformPage>
  );
}
