import { ArrowRight, Check, Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CTA_ARROW, CTA_GHOST_DARK, CTA_PRIMARY, DISPLAY, EYEBROW, TEXT_LINK } from "@/components/platform/brand";
import { FaqAccordion } from "@/components/platform/faq-accordion";
import { platformFaq } from "@/components/platform/faq";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { exampleStoreAddress, PLATFORM_EMAIL, platformWhatsappHref } from "@/components/platform/site";
import { getSession } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing/mercadopago";
import { cn } from "@/lib/cn";

import { plansOrEmpty, platformMailto } from "../_lib/public-site";
import { ArcWord, CornerArc, Rings } from "../site-shapes";
import "../site.css";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Escribile a Ecommy por mail o WhatsApp: consultas, soporte y plan Business a medida. Respondemos en horario hábil. Preguntas frecuentes sobre planes, cobros y datos.",
  alternates: { canonical: "/contacto" },
};
export const dynamic = "force-dynamic";

const BUSINESS_SUBJECT = "Plan Business";
const BUSINESS_BODY = [
  "Hola, quiero consultar por el plan Business de Ecommy.",
  "",
  "Mi tienda o marca:",
  "Qué vendo:",
  "Cantidad de productos (aprox.):",
  "Cuántas tiendas necesito:",
  "Dónde vendo hoy (web, Instagram, local):",
  "",
].join("\n");

export default async function ContactoPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty("contacto")]);
  const whatsappNumber = process.env.PLATFORM_WHATSAPP;
  const whatsapp = platformWhatsappHref(whatsappNumber, "Hola, tengo una consulta sobre Ecommy");
  const whatsappBusiness = platformWhatsappHref(whatsappNumber, "Hola, quiero consultar por el plan Business de Ecommy.");
  const whatsappDisplay = whatsapp ? `+${(whatsappNumber ?? "").replace(/\D/g, "")}` : null;

  const proProducts = plans.find((p) => p.code === "pro")?.limits.products ?? null;
  const faq = platformFaq({ storeAddress: exampleStoreAddress(), plans, mpEnabled: billingEnabled() });

  const business: [string, string][] = [
    ["Catálogo grande", proProducts ? `más de ${proProducts.toLocaleString("es-AR")} productos, el tope de Pro.` : "catálogos muy grandes, con importaciones y acompañamiento a medida."],
    ["Varias tiendas", "más de las 3 que permite una cuenta, o varias marcas con un mismo equipo."],
    ["Dominio propio", "te acompañamos a conectarlo y a revisar que quede todo andando."],
    ["Mudanza asistida", "pasamos el catálogo desde tu tienda actual y cargamos las redirecciones para no perder lo que ya tenés en Google."],
  ];

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <section className="relative overflow-hidden">
        <CornerArc corner="tr" size={520} className="hidden bg-eco-durazno/70 md:block" />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 md:pt-20 md:pb-24">
          <div className="eco-pop max-w-[60ch]">
            <p className={EYEBROW}>Contacto</p>
            <h1 className={cn(DISPLAY, "mt-4 text-[48px] leading-[0.96] sm:text-[72px]")}>
              <ArcWord>Hablemos</ArcWord>.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[19px] leading-[1.4] sm:text-[21px]">Respondemos en horario hábil, de lunes a viernes.</p>
            <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-adm-fg-muted">
              Si ya tenés una tienda, contanos su dirección (del estilo {exampleStoreAddress("taller-luna")}) y qué pasó o qué querés hacer. Con
              eso vamos directo, sin ida y vuelta.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-12">
            <div className={cn("grid content-start gap-5 lg:col-span-7", whatsapp && "sm:grid-cols-2")}>
              <a
                href={platformMailto("Consulta sobre Ecommy")}
                className="site-lift group flex min-w-0 flex-col justify-between gap-8 border border-eco-line bg-adm-surface p-6 sm:p-7"
              >
                <span className="flex items-center justify-between gap-4">
                  <span className="flex size-12 items-center justify-center rounded-[18px] rounded-bl-[4px] bg-eco-durazno text-eco-ink">
                    <Mail className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span aria-hidden className="site-arrow flex size-10 items-center justify-center rounded-full bg-eco-niebla-2 text-eco-ink">
                    <ArrowRight className="size-4" strokeWidth={2} />
                  </span>
                </span>
                <span>
                  <span className="block text-[13px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">Mail</span>
                  <span className={cn(DISPLAY, "mt-1 block text-[22px] leading-tight break-all sm:text-[26px]")}>{PLATFORM_EMAIL}</span>
                  <span className="mt-2 block text-[14px] leading-relaxed text-adm-fg-muted">
                    Para todo: consultas antes de empezar, soporte, planes y pagos, y pedidos sobre tus datos personales.
                  </span>
                </span>
              </a>
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-lift group flex min-w-0 flex-col justify-between gap-8 border border-eco-line bg-adm-surface p-6 sm:p-7"
                >
                  <span className="flex items-center justify-between gap-4">
                    <span className="flex size-12 items-center justify-center rounded-[18px] rounded-bl-[4px] bg-eco-azul-soft text-adm-link">
                      <MessageCircle className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span aria-hidden className="site-arrow flex size-10 items-center justify-center rounded-full bg-eco-niebla-2 text-eco-ink">
                      <ArrowRight className="size-4" strokeWidth={2} />
                    </span>
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold tracking-[0.06em] text-adm-fg-muted uppercase">WhatsApp</span>
                    <span className={cn(DISPLAY, "tnum mt-1 block text-[22px] leading-tight sm:text-[26px]")}>{whatsappDisplay}</span>
                    <span className="mt-2 block text-[14px] leading-relaxed text-adm-fg-muted">
                      Para consultas rápidas y para coordinar un cambio de plan. Abre el chat con el mensaje empezado.
                    </span>
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </span>
                </a>
              ) : null}
              <p className={cn("eco-bubble bg-eco-azul-soft px-5 py-4 text-[15px] leading-relaxed [--eco-bubble-r:20px]", whatsapp && "sm:col-span-2")}>
                Antes de escribir, mirá el{" "}
                <Link href="/ayuda" className={TEXT_LINK}>
                  centro de ayuda
                </Link>
                : ahí está, paso a paso, cómo cargar productos, cobrar, armar las zonas de envío y cumplir con los legales.
              </p>
            </div>

            <aside
              id="business"
              aria-labelledby="business-t"
              className="eco-bubble relative scroll-mt-24 self-start overflow-hidden bg-eco-ink p-7 text-eco-mist [--eco-bubble-r:32px] sm:p-9 lg:col-span-5"
            >
              <Rings size={520} count={5} className="-top-60 -right-52 text-eco-ink-3" />
              <div className="relative">
                <p className="text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase">Plan Business</p>
                <h2 id="business-t" className={cn(DISPLAY, "mt-3 text-[28px] leading-[1.04] text-white sm:text-[32px]")}>
                  Cuando Pro te queda chico, lo armamos a medida.
                </h2>
                <ul className="mt-6 space-y-3 text-[14px] leading-relaxed">
                  {business.map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <span aria-hidden className="mt-1 flex size-[18px] shrink-0 items-center justify-center rounded-full rounded-bl-[4px] bg-eco-pomelo text-eco-ink">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span>
                        <span className="font-semibold text-white">{t}:</span> {d}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[14px] leading-relaxed text-eco-bruma">
                  Contanos qué vendés, cuántos productos tenés y cuántas tiendas necesitás. Te respondemos con una propuesta y un precio.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={platformMailto(BUSINESS_SUBJECT, BUSINESS_BODY)} className={CTA_PRIMARY}>
                    Escribir por mail
                    <span className={CTA_ARROW}>
                      <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                    </span>
                  </a>
                  {whatsappBusiness ? (
                    <a href={whatsappBusiness} target="_blank" rel="noopener noreferrer" className={CTA_GHOST_DARK}>
                      <MessageCircle className="size-4" strokeWidth={1.75} aria-hidden />
                      Por WhatsApp
                      <span className="sr-only">(se abre en otra pestaña)</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="preguntas" aria-labelledby="preguntas-t" className="scroll-mt-20 border-t border-eco-line bg-adm-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className={EYEBROW}>Preguntas</p>
            <h2 id="preguntas-t" className={cn(DISPLAY, "mt-3 text-[32px] leading-none sm:text-[40px]")}>
              Preguntas frecuentes
            </h2>
            <Link href="/planes" className={cn(TEXT_LINK, "mt-5 inline-flex min-h-11 items-center text-[15px]")}>
              Ver planes y precios
            </Link>
          </div>
          <div>
            <FaqAccordion items={faq} />
            <p className="mt-8 max-w-[68ch] text-[14px] leading-relaxed text-adm-fg-muted">
              Las condiciones completas están en los{" "}
              <Link href="/terminos" className={TEXT_LINK}>
                términos del servicio
              </Link>{" "}
              y en la{" "}
              <Link href="/privacidad" className={TEXT_LINK}>
                política de privacidad
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </PlatformPage>
  );
}
