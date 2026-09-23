import { Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqList } from "@/components/platform/FaqList";
import { platformFaq } from "@/components/platform/faq";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { exampleStoreAddress, PLATFORM_EMAIL, platformWhatsappHref } from "@/components/platform/site";
import { getSession } from "@/lib/auth";

import { plansOrEmpty, platformMailto } from "../_lib/public-site";

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
  const faq = platformFaq({ storeAddress: exampleStoreAddress(), plans });

  return (
    <PlatformPage signedIn={Boolean(user)}>
      <section className="border-b border-adm-border bg-adm-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="min-w-0">
            <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] sm:text-[36px]">Contacto</h1>
            <p className="mt-3 max-w-[46ch] text-[17px] leading-snug">Escribinos: respondemos en horario hábil, de lunes a viernes.</p>
            <p className="mt-3 max-w-[56ch] text-[14px] leading-relaxed text-adm-fg-muted">
              Si ya tenés una tienda, contanos su dirección (del estilo {exampleStoreAddress("taller-luna")}) y qué pasó o qué querés hacer. Con
              eso vamos directo, sin ida y vuelta.
            </p>

            <p className="mt-6 max-w-[560px] border-l-[3px] border-adm-accent-2 pl-3 text-[14px] leading-relaxed">
              Antes de escribir, mirá el{" "}
              <Link href="/ayuda" className="font-medium text-adm-accent underline underline-offset-2">
                centro de ayuda
              </Link>
              : ahí está, paso a paso, cómo cargar productos, cobrar, armar las zonas de envío y cumplir con los legales.
            </p>

            <dl className="mt-6 max-w-[560px] border-b border-adm-border">
              <div className="grid gap-x-6 gap-y-1 border-t border-adm-border py-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="flex items-center gap-2 text-[13px] text-adm-fg-muted">
                  <Mail className="size-[18px]" strokeWidth={1.5} aria-hidden />
                  Mail
                </dt>
                <dd>
                  <a
                    href={platformMailto("Consulta sobre Ecommy")}
                    className="text-[20px] font-semibold tracking-[-0.01em] text-adm-accent underline-offset-4 hover:underline"
                  >
                    {PLATFORM_EMAIL}
                  </a>
                  <p className="mt-1 text-[13px] leading-relaxed text-adm-fg-muted">
                    Para todo: consultas antes de empezar, soporte, planes y pagos, y pedidos sobre tus datos personales.
                  </p>
                </dd>
              </div>
              {whatsapp ? (
                <div className="grid gap-x-6 gap-y-1 border-t border-adm-border py-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <dt className="flex items-center gap-2 text-[13px] text-adm-fg-muted">
                    <MessageCircle className="size-[18px]" strokeWidth={1.5} aria-hidden />
                    WhatsApp
                  </dt>
                  <dd>
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tnum text-[20px] font-semibold tracking-[-0.01em] text-adm-accent underline-offset-4 hover:underline"
                    >
                      {whatsappDisplay}
                    </a>
                    <p className="mt-1 text-[13px] leading-relaxed text-adm-fg-muted">
                      Para consultas rápidas y para coordinar un cambio de plan. Abre el chat con el mensaje empezado.
                    </p>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <aside id="business" aria-labelledby="business-t" className="scroll-mt-6 self-start rounded-adm border border-adm-border bg-adm-bg p-5 sm:p-6">
            <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Plan Business</p>
            <h2 id="business-t" className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
              Cuando Pro te queda chico, lo armamos a medida.
            </h2>
            <ul className="mt-4 text-[14px] leading-relaxed">
              <li className="border-t border-adm-border py-2.5">
                <span className="font-medium">Catálogo grande:</span>{" "}
                <span className="text-adm-fg-muted">
                  {proProducts ? `más de ${proProducts.toLocaleString("es-AR")} productos, el tope de Pro.` : "más productos de los que permite Pro."}
                </span>
              </li>
              <li className="border-t border-adm-border py-2.5">
                <span className="font-medium">Varias tiendas:</span>{" "}
                <span className="text-adm-fg-muted">más de las 3 que permite una cuenta, o varias marcas con un mismo equipo.</span>
              </li>
              <li className="border-t border-adm-border py-2.5">
                <span className="font-medium">Dominio propio:</span>{" "}
                <span className="text-adm-fg-muted">te acompañamos a conectarlo y a revisar que quede todo andando.</span>
              </li>
              <li className="border-y border-adm-border py-2.5">
                <span className="font-medium">Mudanza asistida:</span>{" "}
                <span className="text-adm-fg-muted">pasamos el catálogo desde tu tienda actual y cargamos las redirecciones para no perder lo que ya tenés en Google.</span>
              </li>
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-adm-fg-muted">
              Contanos qué vendés, cuántos productos tenés y cuántas tiendas necesitás. Te respondemos con una propuesta y un precio.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={platformMailto(BUSINESS_SUBJECT, BUSINESS_BODY)}
                className="inline-flex h-10 items-center gap-2 rounded-adm bg-adm-accent px-4 text-sm font-medium text-adm-accent-fg transition-colors hover:bg-adm-accent-hover"
              >
                <Mail className="size-4" strokeWidth={1.5} aria-hidden />
                Escribir por mail
              </a>
              {whatsappBusiness ? (
                <a
                  href={whatsappBusiness}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-adm border border-adm-input-border bg-adm-surface px-4 text-sm font-medium text-adm-fg transition-colors hover:bg-adm-hover"
                >
                  <MessageCircle className="size-4" strokeWidth={1.5} aria-hidden />
                  Escribir por WhatsApp
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <section id="preguntas" aria-labelledby="preguntas-t" className="scroll-mt-4">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="preguntas-t" className="text-[26px] leading-tight font-semibold tracking-[-0.025em] sm:text-[30px]">
              Preguntas frecuentes
            </h2>
            <Link href="/planes" className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
              Ver planes y precios
            </Link>
          </div>
          <FaqList className="mt-8" items={faq} />
          <p className="mt-10 max-w-[68ch] border-t border-adm-border pt-5 text-[13px] leading-relaxed text-adm-fg-muted">
            Las condiciones completas están en los{" "}
            <Link href="/terminos" className="text-adm-accent underline underline-offset-2">
              términos del servicio
            </Link>{" "}
            y en la{" "}
            <Link href="/privacidad" className="text-adm-accent underline underline-offset-2">
              política de privacidad
            </Link>
            .
          </p>
        </div>
      </section>
    </PlatformPage>
  );
}
