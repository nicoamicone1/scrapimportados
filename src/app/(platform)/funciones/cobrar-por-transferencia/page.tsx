import { CalendarClock, CreditCard, Wallet } from "lucide-react";
import Link from "next/link";

import { DISPLAY, TEXT_LINK } from "@/components/platform/brand";
import { LazyFontSheets } from "@/components/platform/LazyFontSheets";
import { TRANSFER_FLOW, TRANSFER_META, transferFaq } from "@/components/platform/landing-pages/content";
import { landingPageJsonLd, type Crumb } from "@/components/platform/landing-pages/jsonld";
import { landingMetadata } from "@/components/platform/landing-pages/metadata";
import { OrderPageMock } from "@/components/platform/landing-pages/OrderPageMock";
import { OrderTicket } from "@/components/platform/landing-pages/OrderTicket";
import { ClosingSheet, FaqSheet, FlowSteps, PageHero, SectionHead, Sheet } from "@/components/platform/landing-pages/parts";
import { CommissionCalc } from "@/components/platform/landing/CommissionCalc";
import { BrowserFrame } from "@/components/platform/landing/Frames";
import { StoreMock } from "@/components/platform/landing/StoreMock";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { demoStoreHref, exampleStoreAddress } from "@/components/platform/site";
import { JsonLd } from "@/components/store/JsonLd";
import { cn } from "@/lib/cn";
import { platformOrigin } from "@/lib/tenant/urls";

import { plansOrEmpty } from "../../_lib/public-site";

/*
 * /funciones/cobrar-por-transferencia (MARKETING §6.2: «tienda online con
 * pago por transferencia», «transferencia bancaria descuento»). El recibo
 * #1042 con "Comisión de Ecommy $ 0", la página del pedido que ve la
 * clienta y la calculadora de la landing. Mercado Pago como alternativa,
 * dicho como es: la comisión de Mercado Pago la cobra Mercado Pago.
 * Estática con revalidación (planes en caché, sin sesión).
 */
export const revalidate = 600;

export const metadata = landingMetadata(TRANSFER_META);

const CRUMBS: Crumb[] = [
  { label: "Inicio", href: "/" },
  { label: "Cobrar por transferencia", href: TRANSFER_META.path },
];

const CARD_FACTS = [
  {
    icon: CreditCard,
    title: "Cuotas sin interés, si las activás",
    text: "En 3, 6, 9 o 12, desde tu Mercado Pago. La tienda las anuncia en cada producto y en el checkout.",
  },
  {
    icon: Wallet,
    title: "La plata entra a tu Mercado Pago",
    text: "Conectás tu cuenta en un paso. El pedido se marca como pagado solo, sin que mires el comprobante.",
  },
  {
    icon: CalendarClock,
    title: "La comisión la cobra Mercado Pago",
    text: "Según el plazo de acreditación que elijas en tu cuenta. Ecommy no suma nada encima.",
  },
];

export default async function CobrarPorTransferenciaPage() {
  const plans = await plansOrEmpty("cobrar-por-transferencia");
  const demo = demoStoreHref();
  const luna = exampleStoreAddress("luna-indumentaria");
  const faq = transferFaq();
  const refPlan = plans.find((p) => p.code === "starter" && (p.priceMonthly ?? 0) > 0) ?? plans.find((p) => (p.priceMonthly ?? 0) > 0);

  const jsonLd = landingPageJsonLd({
    origin: platformOrigin(),
    path: TRANSFER_META.path,
    title: TRANSFER_META.title,
    description: TRANSFER_META.description,
    crumbs: CRUMBS,
    faq,
  });

  return (
    <PlatformPage signedIn={false} footerOverlap className="lp-page">
      <JsonLd data={jsonLd} />
      {/* Fuentes del estilo de la tienda de ejemplo: se piden cuando se acerca al viewport. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <LazyFontSheets />

      <PageHero
        crumbs={CRUMBS}
        eyebrow="Cobrar por transferencia"
        title="Cobrá por transferencia, con descuento y sin comisión."
        lead={
          <p>
            Tu tienda muestra el precio con transferencia desde la card, tu clienta copia el alias desde su pedido y el stock queda reservado
            mientras te paga. La plata va de su cuenta a la tuya: Ecommy no se queda con nada.
          </p>
        }
        demoHref={demo}
        visual={<OrderTicket className="sm:mt-6" />}
      />

      {/* Cómo funciona ---------------------------------------------------- */}
      <Sheet id="como-funciona" label="como-t" className="bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead eyebrow="Cómo funciona" id="como-t" title="Del precio con descuento al pago confirmado.">
            Lo mismo que hacés hoy por chat, pero con el pedido armado, el total calculado y el stock apartado mientras esperás el comprobante.
          </SectionHead>
          <div className="mt-12 grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            <FlowSteps steps={TRANSFER_FLOW} />
            <div className="relative min-w-0 pb-6">
              <div aria-hidden className="absolute -top-6 -left-8 size-64 rounded-full bg-eco-durazno sm:size-80" />
              <div className="eco-reveal relative sm:w-[88%]">
                <BrowserFrame address={luna} className="lp-tilt-l" bodyClassName="aspect-square min-[520px]:aspect-[4/3]">
                  <StoreMock address={luna} />
                </BrowserFrame>
              </div>
              <div className="eco-reveal relative -mt-16 ml-auto w-[78%] max-w-[300px] sm:-mt-40 sm:w-[46%] lg:-mt-48">
                <OrderPageMock />
              </div>
            </div>
          </div>
          <p className="mt-12 text-[15px] text-eco-text-muted">
            En todos los planes. Paso a paso en la ayuda:{" "}
            <Link href="/ayuda/pedidos-y-cobros" className={TEXT_LINK}>
              pedidos y cobros
            </Link>
            .
          </p>
        </div>
      </Sheet>

      {/* Sin comisión ----------------------------------------------------- */}
      <Sheet id="sin-comision" label="comision-t" className="bg-eco-ink text-eco-mist [--lp-pb:96px] md:[--lp-pb:136px]">
        <div aria-hidden className="lp-rings pointer-events-none absolute inset-0 rounded-t-[32px] [--lp-ring:rgb(255_255_255/0.05)] [--lp-rings-at:100%_0%]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-16">
          <div className="min-w-0">
            <SectionHead dark eyebrow="Sin comisión por venta" id="comision-t" title="Lo que te transfieren es tuyo. Entero.">
              Tu costo es el plan, fijo por mes. No hay pasarela en el medio ni porcentaje por venta: la transferencia va de la cuenta de tu clienta a la
              tuya.
            </SectionHead>
            <h3 className="mt-12 text-[15px] font-semibold text-white">Lo que tenés que saber</h3>
            <ul className="mt-4 space-y-4 text-[15px] leading-relaxed text-eco-bruma">
              <li className="border-l-2 border-eco-pomelo pl-4">
                El pago lo confirmás vos al ver el comprobante. Ecommy no ve tu cuenta bancaria y no mueve tu plata.
              </li>
              <li className="border-l-2 border-eco-ink-3 pl-4">
                Elegís cuántas horas reservás el stock. Si no registrás el pago en ese plazo, el pedido se cancela solo y el stock vuelve; con 0, no vence
                nunca.
              </li>
              <li className="border-l-2 border-eco-ink-3 pl-4">
                El descuento se aplica al elegir transferencia en el checkout, y el precio con descuento se ve antes, en cada producto.
              </li>
            </ul>
          </div>
          <div className="min-w-0 lg:pt-2">
            <CommissionCalc plan={refPlan?.priceMonthly ? { name: refPlan.name, price: refPlan.priceMonthly } : null} />
          </div>
        </div>
      </Sheet>

      {/* Mercado Pago ----------------------------------------------------- */}
      <Sheet id="tarjeta" label="tarjeta-t" className="bg-eco-durazno [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <SectionHead eyebrow="Si te quieren pagar con tarjeta" id="tarjeta-t" title="Mercado Pago, con tu cuenta.">
            <span className="text-eco-ink">
              Transferencia para quien quiere el descuento; tarjeta y cuotas para quien no. Las dos en la misma tienda, en todos los planes.
            </span>
          </SectionHead>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-3 lg:pt-10">
            {CARD_FACTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="eco-reveal min-w-0">
                <span aria-hidden className="eco-bubble flex size-10 items-center justify-center bg-eco-ink text-eco-durazno [--eco-bubble-r:14px]">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className={cn("mt-4 text-[16px] font-semibold text-eco-ink")}>{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-eco-ink">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      <FaqSheet
        items={faq}
        aside={
          <p className="mt-6 max-w-[36ch] text-[14px] leading-relaxed text-eco-text-muted">
            ¿Te escriben por WhatsApp? Mirá{" "}
            <Link href="/funciones/pedidos-por-whatsapp" className={TEXT_LINK}>
              cómo te llega el pedido armado
            </Link>
            . ¿Venís de otra plataforma?{" "}
            <Link href="/alternativa-a-tiendanube" className={TEXT_LINK}>
              Comparala con Ecommy
            </Link>
            .
          </p>
        }
      />

      <ClosingSheet title={<>Tu alias, tu descuento, tu plata. Ecommy, <span className={cn(DISPLAY, "whitespace-nowrap")}>$ 0</span> por venta.</>} demoHref={demo} />
    </PlatformPage>
  );
}
