import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";

import { DISPLAY, TEXT_LINK } from "@/components/platform/brand";
import { CompareTable, sourceOrder } from "@/components/platform/landing-pages/CompareTable";
import { compareGroups, TIENDANUBE_META, tiendanubeFaq, VERIFIED_AT, whenToChoose } from "@/components/platform/landing-pages/content";
import { landingPageJsonLd, type Crumb } from "@/components/platform/landing-pages/jsonld";
import { landingMetadata } from "@/components/platform/landing-pages/metadata";
import { ClosingSheet, FaqSheet, PageHero, PlansSheet, SectionHead, Sheet, SourceList, VerifiedNote } from "@/components/platform/landing-pages/parts";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { availability, minPlanName } from "@/components/platform/plan-notes";
import { demoStoreHref, formatLegalDate } from "@/components/platform/site";
import { JsonLd } from "@/components/store/JsonLd";
import { cn } from "@/lib/cn";
import { platformOrigin } from "@/lib/tenant/urls";

import { plansOrEmpty } from "../_lib/public-site";

/*
 * /alternativa-a-tiendanube (MARKETING §4 y §6.2: «alternativa a
 * tiendanube», «tiendanube sin comisión»). No vende "una Tiendanube más
 * barata": dice para quién es cada una. Cada dato de Tiendanube sale de su
 * sitio, verificado el día de `VERIFIED_AT` y con su fuente en la página.
 *
 * Estática con revalidación: no lee la sesión (el header muestra "Ingresar")
 * y los planes salen de `listPublicPlans` (caché de 10 min, tag `plans`).
 */
export const revalidate = 600;

export const metadata = landingMetadata(TIENDANUBE_META);

const CRUMBS: Crumb[] = [
  { label: "Inicio", href: "/" },
  { label: "Alternativa a Tiendanube", href: TIENDANUBE_META.path },
];

/** Lo que cuesta cada venta por transferencia, con los números del sitio de Tiendanube. */
function CostCard() {
  const rows = [
    { who: "Tiendanube con pago personalizado", value: "2 % · 1 % · 0,7 %", note: "Costo por transacción en Esencial, Impulso y Escala." },
    { who: "Tiendanube con Pago Nube", value: "1,50 % + IVA", note: "Comisión de Pago Nube por transferencia en Inicial y Esencial; 0,99 % y 0,85 % + IVA en Impulso y Escala." },
  ];
  return (
    <figure className="eco-bubble relative overflow-hidden bg-eco-ink p-6 text-white [--eco-bubble-r:32px] sm:p-8">
      <div aria-hidden className="lp-rings pointer-events-none absolute inset-0 [--lp-ring:rgb(255_255_255/0.05)] [--lp-rings-at:100%_0%]" />
      <figcaption className="relative text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase">Lo que se lleva cada venta por transferencia</figcaption>
      <div className="relative mt-6 flex items-end justify-between gap-4 border-b border-eco-ink-3 pb-6">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Ecommy</p>
          <p className="mt-1 text-[13px] leading-snug text-eco-bruma">En todos los planes. Pagás el plan fijo por mes.</p>
        </div>
        <span className={cn(DISPLAY, "eco-bubble tnum shrink-0 bg-eco-pomelo px-4 py-2 text-[36px] leading-none text-eco-ink [--eco-bubble-r:18px]")}>0 %</span>
      </div>
      <dl className="relative">
        {rows.map((r) => (
          <div key={r.who} className="border-b border-eco-ink-3 py-5 last:border-b-0 last:pb-1">
            <dt className="text-[14px] font-semibold text-eco-mist">{r.who}</dt>
            <dd className="mt-1">
              <span className={cn(DISPLAY, "tnum block text-[24px] leading-tight text-white")}>{r.value}</span>
              <span className="mt-1 block text-[13px] leading-snug text-eco-bruma">{r.note}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="relative mt-4 text-[12px] leading-snug text-eco-bruma">
        Además del plan mensual de cada una. Tiendanube, verificado en su sitio el{" "}
        <time dateTime={VERIFIED_AT}>{formatLegalDate(VERIFIED_AT)}</time> (
        <a href="#fuentes" className="text-eco-azul-light underline underline-offset-2 hover:text-white">
          fuentes
        </a>
        ).
      </p>
    </figure>
  );
}

export default async function AlternativaTiendanubePage() {
  const plans = await plansOrEmpty("alternativa-a-tiendanube");
  const demo = demoStoreHref();
  const groups = compareGroups(plans);
  const choose = whenToChoose(plans);
  const faq = tiendanubeFaq(plans);
  const webPlan = minPlanName(plans, "catalog.import_web") ?? "Pro";
  const domain = availability(plans, "domain.custom");

  const origin = platformOrigin();
  const jsonLd = landingPageJsonLd({
    origin,
    path: TIENDANUBE_META.path,
    title: TIENDANUBE_META.title,
    description: TIENDANUBE_META.description,
    crumbs: CRUMBS,
    faq,
  });

  const move = [
    {
      title: "Traemos tu catálogo",
      text: `Pegás la dirección de tu tienda y «Detectar» te muestra qué se puede traer antes de importar (${webPlan}, incluido en la prueba). Está probado con WooCommerce, Shopify y sitios con datos schema.org; con tiendas de Tiendanube todavía no lo probamos en casos reales. Intentamos traerlo y lo que falta lo cargamos nosotros.`,
    },
    {
      title: "Cargás las redirecciones 301",
      text: "Cada dirección vieja apunta a la nueva, una por una o en CSV. Los links que Google ya conoce siguen llevando a tus productos.",
    },
    {
      title: "Traés tu dominio",
      text: `Para que las 301 sirvan, tu dominio tiene que apuntar a Ecommy (dominio propio ${domain}). Lo conectamos con vos.`,
    },
    {
      title: "Cambiás cuando estés conforme",
      text: "Durante la prueba tu tienda actual sigue abierta. Comparás con tus clientas reales y movés el dominio el día que quieras.",
    },
  ];

  return (
    <PlatformPage signedIn={false} footerOverlap className="lp-page">
      <JsonLd data={jsonLd} />

      <PageHero
        crumbs={CRUMBS}
        eyebrow="Alternativa a Tiendanube"
        title="Si vendés por chat, pagá por eso y nada más."
        lead={
          <>
            <p>
              Ecommy no es una Tiendanube más barata. Es el sistema de pedidos para marcas que venden por Instagram y WhatsApp y cobran por
              transferencia: la clienta arma el pedido con talle y color y te llega armado, sin comisión por venta.
            </p>
            <p className="mt-3 text-[16px] text-eco-text-muted sm:text-[17px]">
              Si necesitás correos con etiqueta, Mercado Libre o apps, hoy Tiendanube te sirve más. Abajo está todo, con fuentes.
            </p>
          </>
        }
        demoHref={demo}
        visual={<CostCard />}
      />

      {/* Cuándo te conviene cada una --------------------------------------- */}
      <Sheet id="cual-te-conviene" label="conviene-t" className="bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead eyebrow="Sin vueltas" id="conviene-t" title="Cuándo te conviene cada una.">
            Decirlo ahora te ahorra un mes de prueba. Si te reconocés en la primera lista, quedate donde estás.
          </SectionHead>
          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-12">
            <article aria-labelledby="tn-t" className="min-w-0">
              <h3 id="tn-t" className={cn(DISPLAY, "text-[24px] leading-tight sm:text-[28px]")}>
                Quedate en Tiendanube si…
              </h3>
              <ul className="mt-6 space-y-3">
                {choose.tiendanube.map((item) => (
                  <li key={item.title} className="eco-reveal flex gap-3.5 rounded-[20px] bg-eco-niebla p-4">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-eco-paper text-eco-text-muted shadow-[0_0_0_1px_var(--eco-line)]">
                      <Minus className="size-3.5" strokeWidth={2.25} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-eco-ink">{item.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-relaxed text-eco-text-muted">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
            <article aria-labelledby="eco-t" className="min-w-0">
              <h3 id="eco-t" className={cn(DISPLAY, "text-[24px] leading-tight sm:text-[28px]")}>
                Elegí Ecommy si…
              </h3>
              <ul className="mt-6 space-y-3">
                {choose.ecommy.map((item) => (
                  <li key={item.title} className="eco-reveal flex gap-3.5 rounded-[20px] bg-eco-pomelo-soft p-4">
                    <span className="eco-bubble mt-0.5 flex size-7 shrink-0 items-center justify-center bg-eco-pomelo text-eco-ink [--eco-bubble-r:10px]">
                      <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-eco-ink">{item.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-relaxed text-eco-ink">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </Sheet>

      {/* Punto por punto -------------------------------------------------- */}
      <Sheet id="comparar" label="comparar-t" className="bg-eco-niebla [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead eyebrow="Comparación" id="comparar-t" title="Ecommy y Tiendanube, punto por punto.">
            Sólo lo que podemos sostener. Donde las dos hacen lo mismo, dice «Paridad»; donde Tiendanube tiene más, también lo dice.
          </SectionHead>
          <VerifiedNote who="Tiendanube" className="mt-4" />
          <div className="mt-8">
            <CompareTable
              groups={groups}
              captionId="comparar-caption"
              caption={`Ecommy y Tiendanube punto por punto. Datos de Tiendanube verificados en su sitio el ${formatLegalDate(VERIFIED_AT)}.`}
            />
          </div>
          <SourceList ids={sourceOrder(groups)} className="mt-12 border-t border-eco-line pt-8" />
        </div>
      </Sheet>

      {/* Mudanza ---------------------------------------------------------- */}
      <Sheet id="mudanza" label="mudanza-t" className="bg-eco-ink text-eco-mist [--lp-pb:96px] md:[--lp-pb:128px]">
        <div aria-hidden className="lp-rings pointer-events-none absolute inset-0 rounded-t-[32px] [--lp-ring:rgb(255_255_255/0.05)] [--lp-rings-at:0%_0%]" />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead dark eyebrow="Mudanza" id="mudanza-t" title="Cómo mudarte sin perder lo que ganaste en Google.">
            No hace falta cerrar nada para probar. Y cuando te mudes, las direcciones viejas siguen llevando a tus productos.
          </SectionHead>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {move.map((m, i) => (
              <li key={m.title} className="eco-reveal min-w-0 border-t-2 border-eco-ink-3 pt-5">
                <span aria-hidden className={cn(DISPLAY, "tnum text-[40px] leading-none text-eco-pomelo")}>
                  {i + 1}
                </span>
                <h3 className="mt-3 text-[17px] font-semibold text-white">
                  <span className="sr-only">Paso {i + 1}: </span>
                  {m.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-eco-bruma">{m.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-2">
            <Link
              href="/guias/migrar-tienda-online-sin-perder-seo"
              className="group inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-white underline decoration-eco-pomelo decoration-2 underline-offset-4"
            >
              Guía: migrar tu tienda sin perder SEO
              <ArrowRight className="size-4 transition-transform duration-[240ms] ease-eco-out group-hover:translate-x-1" strokeWidth={2} aria-hidden />
            </Link>
            <Link
              href="/ayuda/importar-desde-otra-tienda"
              className="inline-flex min-h-11 items-center text-[15px] font-semibold text-eco-azul-light underline decoration-2 underline-offset-4 hover:text-white"
            >
              Cómo funciona el importador
            </Link>
          </div>
        </div>
      </Sheet>

      <PlansSheet plans={plans} title="Probás Pro 14 días. Después elegís.">
        Toda tienda nueva arranca con 14 días de Pro, sin tarjeta. Precios finales en pesos, por mes y por tienda, sin costo por venta en ningún plan.
        Si no elegís un plan pago, pasás a Free y no se borra nada.
      </PlansSheet>

      <FaqSheet
        items={faq}
        aside={
          <p className="mt-6 max-w-[36ch] text-[14px] leading-relaxed text-eco-text-muted">
            ¿Vendés por WhatsApp? Mirá{" "}
            <Link href="/funciones/pedidos-por-whatsapp" className={TEXT_LINK}>
              cómo te llega el pedido
            </Link>{" "}
            y{" "}
            <Link href="/funciones/cobrar-por-transferencia" className={TEXT_LINK}>
              cómo cobrás por transferencia
            </Link>
            .
          </p>
        }
      />

      <ClosingSheet title="Probalo al lado de tu tienda actual. Sin cerrar nada." demoHref={demo} />
    </PlatformPage>
  );
}
