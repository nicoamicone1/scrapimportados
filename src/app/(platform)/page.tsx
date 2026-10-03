import { ArrowRight, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandGlyph, bubbleRadii } from "@/app/_brand/glyph";
import { DISPLAY, EYEBROW, H2, TEXT_LINK } from "@/components/platform/brand";
import { FaqAccordion } from "@/components/platform/faq-accordion";
import { LazyFontSheets } from "@/components/platform/LazyFontSheets";
import { pickFaq, platformFaq } from "@/components/platform/faq";
import { CommissionCalc } from "@/components/platform/landing/CommissionCalc";
import { BrowserFrame, PhoneShot } from "@/components/platform/landing/Frames";
import { Hero, SAMPLE_ORDER, sampleTotals } from "@/components/platform/landing/Hero";
import { CatalogDemo, CheckoutDemo, PricesDemo, ZonesDemo } from "@/components/platform/landing/PanelDemos";
import { SHOTS } from "@/components/platform/landing/shots";
import { Steps, type StepCopy } from "@/components/platform/landing/Steps";
import { StoreDemo, type DemoKind } from "@/components/platform/landing/StoreDemo";
import { PlanCards, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { landingPlanLines, type PlanLike } from "@/components/platform/plan-notes";
import { exampleStoreAddress, PLATFORM_EMAIL } from "@/components/platform/site";
import { presetSpecimens, SPECIMEN_SCENES, specimenPlanLabel } from "@/components/platform/specimens";
import { JsonLd } from "@/components/store/JsonLd";
import { getSession } from "@/lib/auth";
import { billingEnabled } from "@/lib/billing/mercadopago";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { listPublicPlans, type PublicPlan } from "@/lib/plans/catalog";
import { platformOrigin, storeHref } from "@/lib/tenant/urls";
import { PRESET_LIST } from "@/lib/theme";
import { APP_NAME } from "@/lib/version";

const TITLE = "Ecommy · Tu tienda online, sin comisión por venta";
const DESCRIPTION =
  "Creá tu tienda online con catálogo, stock y carrito. Los pedidos te llegan armados por WhatsApp y cobrás por transferencia o con tarjeta en tu Mercado Pago, sin comisión por venta de Ecommy. 14 días de Pro gratis, sin tarjeta.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Next reemplaza el objeto `openGraph` entero: se repite lo del layout.
  openGraph: { siteName: APP_NAME, locale: "es_AR", type: "website", title: TITLE, description: DESCRIPTION, url: "/" },
};
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Contenido                                                            */
/* ------------------------------------------------------------------ */

/*
 * Los "desde qué plan" salen de los planes de la base (`plan-notes`); sin
 * planes cargados, de los defaults del código (mismo texto que con el seed).
 */

function steps(plans: readonly PlanLike[]): [StepCopy, StepCopy, StepCopy] {
  const { csvPlan, webPlan } = landingPlanLines(plans);
  return [
    {
      title: "Creás la tienda",
      text: "Nombre y rubro: el rubro define el estilo con el que arranca. Después, el WhatsApp donde te llegan los pedidos.",
      time: "unos 5 minutos",
    },
    {
      title: "Cargás el catálogo",
      text: `A mano, con fotos, talles, colores y stock por variante. O desde tu planilla en CSV (desde ${csvPlan}), o importando tu tienda de WooCommerce o Shopify (${webPlan}, incluido en la prueba).`,
      time: "lo que tardes en revisarlo",
    },
    {
      title: "Compartís el link",
      text: "En la bio de Instagram, en tus estados o donde ya vendés. El cliente arma el carrito y confirma: el pedido queda registrado y te llega por WhatsApp.",
      time: "el mismo día que publicás",
    },
  ];
}

function demos(plans: readonly PlanLike[]): { id: string; title: string; text: string; plans: string; demo: ReactNode; className: string }[] {
  const lines = landingPlanLines(plans);
  return [
    {
      id: "precios",
      title: "Precios al día, en un paso",
      text: "Subí un 8 % a toda una categoría con redondeo y vista previa. Si te equivocaste, Deshacer.",
      plans: lines.pricing,
      demo: <PricesDemo />,
      className: "lg:col-span-7",
    },
    {
      id: "catalogo",
      title: "Variantes con su stock",
      text: "Talle y color con stock propio. Lo que se agota se tacha solo en la tienda.",
      plans: lines.catalog,
      demo: <CatalogDemo />,
      className: "lg:col-span-5 lg:mt-24",
    },
    {
      id: "zonas",
      title: "Envíos por zona, dibujadas en el mapa",
      text: "Cada zona con su costo y su plazo, y retiro en tu local. El checkout calcula el envío solo.",
      plans: lines.shipping,
      demo: <ZonesDemo />,
      className: "lg:col-span-6",
    },
  ];
}

function also(plans: readonly PlanLike[]): { title: string; text: string; plans: string }[] {
  const lines = landingPlanLines(plans);
  return [
    {
      title: "Ley argentina, resuelta",
      text: "Botón de arrepentimiento, precio sin impuestos nacionales (Ley 27.743), Data Fiscal de ARCA y el aviso de Defensa del Consumidor.",
      plans: "Todos los planes",
    },
    {
      title: "SEO técnico",
      text: `Sitemap, datos estructurados de producto, imagen para compartir y redirecciones 301 desde tu dominio anterior (con dominio propio, ${lines.customDomain}).`,
      plans: "Todos los planes",
    },
    {
      title: "Mudanza desde otra tienda",
      text: "Importás desde WooCommerce, Shopify o webs con datos schema.org, con recargo y redondeo sobre el precio de origen.",
      plans: lines.migration,
    },
    {
      title: "Equipo y auditoría",
      text: "Usuarios con permisos por rol, y cada cambio queda registrado: quién tocó qué precio y cuándo.",
      plans: lines.team,
    },
    {
      title: "Páginas por bloques",
      text: "El inicio y landings de campaña con portada, banners, sliders de productos y cuenta regresiva, sin tocar código.",
      plans: lines.pages,
    },
    {
      title: "Carritos abandonados y precios por cantidad",
      text: "Un mail para retomar el pedido que quedó a medias, y «desde 6 unidades» con su precio, hasta 4 tramos.",
      plans: "Desde Starter",
    },
  ];
}

/**
 * Lo que hoy no hace (MARKETING §1). Decirlo antes de que se registren filtra
 * a quien se va a ir en un mes y compra confianza. Revisado contra el
 * changelog v0.8: con tarjeta se cobra (vía Mercado Pago) y hay precios por
 * cantidad desde v0.5, así que ya no figuran acá.
 */
const NOT_YET = [
  { title: "Etiquetas y cotización de correos", text: "No hay integración con OCA, Andreani ni Correo Argentino: el envío se cobra por zona y lo despachás vos." },
  { title: "Sincronizar stock con Mercado Libre", text: "Si vendés fuerte ahí y necesitás el stock unificado, todavía no está." },
  { title: "Factura electrónica por cada venta", text: "Seguís facturando con tu sistema; Ecommy registra el pedido y el pago." },
  { title: "Otras pasarelas de pago", text: "Con tarjeta se cobra a través de tu cuenta de Mercado Pago. Otros procesadores, todavía no." },
  { title: "Traerte compradores", text: "No es un marketplace: la tienda le vende a quien le llega tu link, desde tus redes, tu WhatsApp o Google." },
] as const;

async function plansOrEmpty(): Promise<PublicPlan[]> {
  try {
    return await listPublicPlans();
  } catch (err) {
    console.error("[landing] planes:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Sección "hoja" (BRAND §7.2): esquinas superiores de 32 px que entran sobre la anterior. */
function Sheet({ id, label, className, children }: { id?: string; label?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={label} className={cn("lp-sheet lp-under-sheet scroll-mt-24 overflow-x-clip", className)}>
      {children}
    </section>
  );
}

/** Logo sobre pomelo (BRAND §4.2): burbuja tinta con la "e" pomelo, que se dibuja. */
function InkMark({ size }: { size: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center bg-eco-ink" style={{ width: size, height: size, ...bubbleRadii(size) }}>
      <BrandGlyph size={Math.round(size * 0.58)} color="var(--eco-pomelo)" draw />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

export default async function LandingPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty()]);
  const signedIn = Boolean(user);
  const start = signedIn ? "/app/nueva" : "/registro";
  const startLabel = signedIn ? "Crear una tienda" : "Crear tu tienda gratis";
  const demo = storeHref({ slug: "demo" });
  const luna = exampleStoreAddress("taller-luna");

  const specimens = presetSpecimens();
  const kinds: DemoKind[] = specimens.map((s) => ({
    kind: s.kind,
    label: s.label,
    hint: s.hint,
    presetId: s.presetId,
    presetName: s.presetName,
    mood: s.mood,
    description: PRESET_LIST.find((p) => p.id === s.presetId)?.description ?? "",
    planLabel: specimenPlanLabel(plans, s),
    product: s.product,
    headline: SPECIMEN_SCENES[s.kind].headline,
    catalog: SPECIMEN_SCENES[s.kind].catalog,
  }));
  const freeCount = kinds.filter((k) => k.planLabel?.startsWith("Incluido")).length;

  const faq = platformFaq({ storeAddress: exampleStoreAddress(), plans, mpEnabled: billingEnabled() });
  const landingFaq = pickFaq(faq, ["comision", "tarjeta", "prueba", "mudanza", "datos", "facturacion"]);

  const { subtotal, discount, total } = sampleTotals();
  const refPlan = plans.find((p) => p.code === "starter" && (p.priceMonthly ?? 0) > 0) ?? plans.find((p) => (p.priceMonthly ?? 0) > 0);

  const origin = platformOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: APP_NAME,
        url: `${origin}/`,
        email: PLATFORM_EMAIL,
        areaServed: { "@type": "Country", name: "Argentina" },
      },
      {
        "@type": "SoftwareApplication",
        name: APP_NAME,
        url: `${origin}/`,
        description: DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "es-AR",
        publisher: { "@id": `${origin}/#organization` },
        offers: plans
          .filter((p) => p.priceMonthly !== null)
          .map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: String(p.priceMonthly),
            priceCurrency: p.currency || "ARS",
            url: `${origin}/planes`,
          })),
      },
    ],
  };

  return (
    <PlatformPage signedIn={signedIn} footerOverlap className="lp-page">
      <JsonLd data={jsonLd} />
      {/* Fuentes de los presets (docs/DESIGN.md §8.19, excepción de la landing):
          la demo de estilos pide la hoja de cada preset recién cuando se acerca
          al viewport o cuando el visitante apunta a un rubro; ninguna bloquea el
          render (el LCP es el h1, en Archivo autohospedada). */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <LazyFontSheets />

      <Hero startHref={start} startLabel={startLabel} demoHref={demo} demoAddress={exampleStoreAddress("demo")} orderUrl={`https://${luna}/pedido/8f3k2`} />

      {/* Probá tu tienda: efecto de posesión ----------------------------- */}
      <Sheet id="probar" label="probar-t" className="bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]">
        <div aria-hidden className="eco-marquee border-b border-eco-line py-4 [--marquee-dur:60s]">
          {[0, 1].map((n) => (
            <p key={n} className={cn(DISPLAY, "flex shrink-0 items-center gap-6 pr-6 text-[20px] text-eco-ink sm:text-[26px]")}>
              {kinds.flatMap((k) => k.catalog.slice(0, 2)).map((t) => (
                <span key={`${n}-${t}`} className="flex items-center gap-6 whitespace-nowrap">
                  {t}
                  <span className="eco-bubble size-3 bg-eco-pomelo [--eco-bubble-r:5px]" />
                </span>
              ))}
            </p>
          ))}
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 md:pt-20">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
            <div className="eco-reveal">
              <p className={EYEBROW}>Probalo ahora, sin registrarte</p>
              <h2 id="probar-t" className={cn(H2, "mt-3 max-w-[17ch] sm:text-[52px]")}>
                Escribí el nombre de tu negocio. Mirá tu tienda.
              </h2>
            </div>
            <p className="eco-reveal max-w-[46ch] text-[16px] leading-relaxed text-eco-text-muted">
              Cada rubro arranca con un estilo propio: tipografías, colores, forma de las fotos, grilla y botones. Lo que ves está dibujado con
              los estilos reales de las tiendas.
              {freeCount ? ` Free incluye ${freeCount}; en la prueba de 14 días usás los ${kinds.length}.` : null}
            </p>
          </div>
          <div className="mt-12">
            <StoreDemo kinds={kinds} initialKind="artesanias" addressTemplate={exampleStoreAddress("__slug__")} startHref={start} />
          </div>
        </div>
      </Sheet>

      {/* Cómo funciona -------------------------------------------------- */}
      <Sheet id="como-funciona" label="como-funciona-t" className="bg-eco-niebla [--lp-pb:96px] md:[--lp-pb:136px]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <div className="eco-reveal flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={EYEBROW}>Cómo funciona</p>
              <h2 id="como-funciona-t" className={cn(H2, "mt-3 max-w-[16ch]")}>
                De cero a tu primer pedido, en una tarde.
              </h2>
            </div>
            <p className="max-w-[38ch] text-[15px] leading-relaxed text-eco-text-muted">
              Sin diseñador ni programador. Lo que necesitás a mano: fotos, precios, talles y tu alias.
            </p>
          </div>
          <div className="mt-14">
            <Steps steps={steps(plans)} address={luna} />
          </div>
        </div>
      </Sheet>

      {/* Sin comisión: el diferencial, en hoja tinta ------------------------ */}
      <Sheet label="comision-t" className="bg-eco-ink text-eco-mist [--lp-pb:96px] md:[--lp-pb:136px]">
        <div aria-hidden className="lp-rings pointer-events-none absolute inset-0 rounded-t-[32px] [--lp-ring:rgb(255_255_255/0.05)] [--lp-rings-at:100%_0%]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="min-w-0">
            <p className="eco-reveal text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase">Sin comisión por venta</p>
            <h2 id="comision-t" className={cn(H2, "eco-reveal mt-3 max-w-[13ch] text-white sm:text-[60px]")}>
              Lo que vendés es tuyo. Entero.
            </h2>
            <p className="eco-reveal mt-6 max-w-[54ch] text-[17px] leading-relaxed text-eco-mist">
              Tu costo es el plan, fijo por mes. Ecommy no se queda con un porcentaje de cada venta: te pagan por transferencia a tu cuenta, o
              con tarjeta y en cuotas a tu cuenta de Mercado Pago, que conectás en un paso.
            </p>
            <div className="mt-10">
              <CommissionCalc plan={refPlan?.priceMonthly ? { name: refPlan.name, price: refPlan.priceMonthly } : null} />
            </div>
          </div>

          <div className="min-w-0 lg:pt-6">
            {/* Recibo: el pedido #1042 con "Comisión de Ecommy $ 0". */}
            <figure className="eco-reveal-right relative mx-auto max-w-[420px]">
              <div aria-hidden className="absolute -top-8 -right-10 size-48 rounded-full bg-eco-pomelo" />
              <div className="lp-tilt-r relative">
                <div className="lp-ticket bg-eco-paper px-6 pt-6 text-eco-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)] [border-start-start-radius:28px] [border-start-end-radius:28px]">
                  <figcaption className="flex items-baseline justify-between gap-3">
                    <span className={cn(DISPLAY, "text-[20px]")}>Pedido #{SAMPLE_ORDER.number}</span>
                    <span className="text-[12px] text-eco-text-muted">{SAMPLE_ORDER.store}</span>
                  </figcaption>
                  <p className="mt-1 text-[13px] text-eco-text-muted">Pagado por transferencia</p>
                  <table className="tnum lp-ticket-rule mt-4 w-full pt-3 text-[14px]">
                    <caption className="sr-only">Ejemplo de un pedido pagado por transferencia</caption>
                    <tbody>
                      {SAMPLE_ORDER.items.map((item) => (
                        <tr key={item.name}>
                          <th scope="row" className="py-1 pr-3 text-left font-normal">
                            {item.qty} × {item.name}
                          </th>
                          <td className="py-1 text-right whitespace-nowrap">{formatMoney(item.total)}</td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row" className="pt-3 pr-3 text-left font-normal text-eco-text-muted">
                          Subtotal
                        </th>
                        <td className="pt-3 text-right whitespace-nowrap">{formatMoney(subtotal)}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-1 pr-3 text-left font-normal text-eco-text-muted">
                          Descuento por transferencia ({SAMPLE_ORDER.transferPercent} %)
                        </th>
                        <td className="py-1 text-right whitespace-nowrap">− {formatMoney(discount)}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-1 pr-3 text-left font-normal text-eco-text-muted">
                          {SAMPLE_ORDER.shipping.label}
                        </th>
                        <td className="py-1 text-right whitespace-nowrap">{formatMoney(SAMPLE_ORDER.shipping.price)}</td>
                      </tr>
                      <tr>
                        <th scope="row" className="pt-3 pr-3 text-left font-semibold">
                          Comisión de Ecommy
                        </th>
                        <td className="pt-3 text-right">
                          <span className="eco-bubble inline-block bg-eco-pomelo px-3 py-1 font-semibold [--eco-bubble-r:12px]">{formatMoney(0)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="lp-ticket-rule mt-4 flex items-end justify-between gap-3 pt-4">
                    <span className="text-[14px] font-semibold">Llega a tu cuenta</span>
                    <span className={cn(DISPLAY, "tnum text-[34px] leading-none")}>{formatMoney(total)}</span>
                  </div>
                </div>
              </div>
            </figure>

            <h3 className="mt-16 text-[15px] font-semibold text-white">Lo que tenés que saber</h3>
            <ul className="mt-4 space-y-4 text-[15px] leading-relaxed text-eco-bruma">
              <li className="border-l-2 border-eco-pomelo pl-4">
                Con transferencia, el pago lo confirmás vos al ver el comprobante. Mientras tanto el pedido reserva el stock por las horas que
                definas; si no se paga, se libera solo.
              </li>
              <li className="border-l-2 border-eco-ink-3 pl-4">
                Con tarjeta, la plata entra directo a tu Mercado Pago y el pedido se marca pagado solo. La comisión de Mercado Pago la cobra
                Mercado Pago, según el plazo que elijas; Ecommy no suma nada.
              </li>
              <li className="border-l-2 border-eco-ink-3 pl-4">
                Las cuotas sin interés las activás en tu Mercado Pago (3, 6, 9 o 12) y la tienda las anuncia en cada producto y en el checkout.
              </li>
            </ul>
          </div>
        </div>
      </Sheet>

      {/* El panel: capturas reales + demos con las que se juega -------------- */}
      <Sheet id="panel" label="panel-t" className="bg-eco-niebla [--lp-pb:96px] md:[--lp-pb:136px]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="eco-reveal">
              <p className={EYEBROW}>El panel</p>
              <h2 id="panel-t" className={cn(H2, "mt-3 max-w-[14ch] sm:text-[52px]")}>
                Lo de todos los días, en un toque.
              </h2>
              <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-eco-text-muted">
                Al entrar ves lo que hay que hacer hoy: pedidos por confirmar, para despachar, pagos sin acreditar y stock bajo. Y funciona igual
                en el celular, con la barra de abajo al alcance del pulgar.
              </p>
            </div>
            <div className="relative min-w-0 pb-10 sm:pr-10 sm:pb-6">
              <div aria-hidden className="absolute -bottom-6 -left-8 size-64 rounded-full bg-eco-durazno sm:size-80" />
              <div className="eco-reveal-right relative">
                <BrowserFrame shot={SHOTS.panelInicio} address="ecommy.app/admin" sizes="(min-width: 1024px) 700px, 92vw" className="lp-tilt-l" />
              </div>
              <div className="eco-reveal absolute -right-1 -bottom-2 w-[32%] max-w-[210px] sm:-right-2">
                <PhoneShot shot={SHOTS.panelPedidosMobile} sizes="210px" className="lp-tilt-r aspect-[540/1169]" />
              </div>
            </div>
          </div>

          <div className="mt-24 grid gap-x-8 gap-y-16 lg:grid-cols-12">
            {demos(plans).map((d) => (
              <article key={d.id} aria-labelledby={`demo-${d.id}`} className={cn("eco-reveal min-w-0", d.className)}>
                <h3 id={`demo-${d.id}`} className={cn(DISPLAY, "text-[24px] leading-tight text-eco-ink sm:text-[28px]")}>
                  {d.title}
                </h3>
                <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-eco-text-muted">{d.text}</p>
                <div className="mt-5">{d.demo}</div>
                <p className="mt-3 text-[13px] text-eco-text-muted">{d.plans}</p>
              </article>
            ))}
            <div className="eco-reveal hidden content-start gap-6 md:grid lg:col-span-6 lg:mt-20">
              <div className="relative">
                <BrowserFrame shot={SHOTS.panelProductos} address="ecommy.app/admin/productos" sizes="(min-width: 1024px) 600px, 92vw" className="lp-tilt-r" />
              </div>
              <p className="max-w-[48ch] text-[15px] leading-relaxed text-eco-text-muted">
                Productos con su foto, precio y stock en una fila; editás precio y stock sin abrir la ficha.
              </p>
            </div>
            <article aria-labelledby="demo-checkout" className="eco-reveal min-w-0 lg:col-span-12">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center lg:gap-12">
                <div>
                  <h3 id="demo-checkout" className={cn(DISPLAY, "text-[24px] leading-tight text-eco-ink sm:text-[28px]")}>
                    El pedido te llega armado
                  </h3>
                  <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-eco-text-muted">
                    Tu cliente elige entrega y pago, confirma, y el pedido queda registrado con número antes de pasar a WhatsApp. El mensaje es el
                    mismo que arma tu tienda: cambiá las opciones y miralo.
                  </p>
                  <p className="mt-3 text-[13px] text-eco-text-muted">En todos los planes</p>
                </div>
                <CheckoutDemo storeName={SAMPLE_ORDER.store} orderUrl={`https://${luna}/pedido/8f3k2`} />
              </div>
            </article>
          </div>

          <div className="mt-24 border-t-2 border-eco-ink pt-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <h3 className={cn(DISPLAY, "eco-reveal text-[28px] leading-tight text-eco-ink")}>Y lo que no se ve, también.</h3>
              <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {also(plans).map((a) => (
                  <div key={a.title} className="eco-reveal">
                    <dt className="text-[15px] font-semibold text-eco-ink">{a.title}</dt>
                    <dd className="mt-1 text-[14px] leading-relaxed text-eco-text-muted">
                      {a.text}
                      <span className="mt-1.5 block text-[12px] font-medium text-eco-pomelo-ink">{a.plans}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Sheet>

      {/* Planes --------------------------------------------------------- */}
      {plans.length ? (
        <Sheet id="planes" label="planes-t" className="bg-eco-pomelo-soft [--lp-pb:88px] md:[--lp-pb:120px]">
          <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
            <div className="eco-reveal flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={EYEBROW}>Planes</p>
                <h2 id="planes-t" className={cn(H2, "mt-3")}>
                  Empezás con todo. Después elegís.
                </h2>
                <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-eco-ink">
                  Toda tienda nueva arranca con 14 días de Pro, sin tarjeta. Si no elegís un plan pago, pasás a Free y no se borra nada. Precios
                  finales en pesos, por mes y por tienda.
                </p>
              </div>
              <Link href="/planes#comparar" className={cn(TEXT_LINK, "inline-flex min-h-11 items-center text-[15px]")}>
                Comparar todo en detalle
              </Link>
            </div>
            <PlanCards
              className="mt-10"
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
          </div>
        </Sheet>
      ) : null}

      {/* Antes de empezar: lo que no hace + preguntas ------------------------ */}
      <Sheet id="preguntas" label="no-hace-t" className="bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div className="min-w-0">
            <p className={EYEBROW}>Antes de empezar</p>
            <h2 id="no-hace-t" className={cn(DISPLAY, "mt-3 text-[30px] leading-[1.05] text-eco-ink sm:text-[38px]")}>
              Lo que hoy Ecommy no hace.
            </h2>
            <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-eco-text-muted">
              Si alguna es imprescindible para tu negocio, mejor saberlo ahora que en un mes.
            </p>
            <ul className="mt-8 space-y-3">
              {NOT_YET.map((item) => (
                <li key={item.title} className="eco-reveal flex gap-3.5 rounded-[20px] bg-eco-niebla p-4">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-eco-paper text-eco-text-muted shadow-[0_0_0_1px_var(--eco-line)]">
                    <Minus className="size-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-eco-ink">{item.title}</span>
                    <span className="mt-0.5 block text-[14px] leading-relaxed text-eco-text-muted">{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className={cn(DISPLAY, "text-[30px] leading-[1.05] text-eco-ink sm:text-[38px]")}>Preguntas frecuentes</h2>
              <Link href="/contacto" className={cn(TEXT_LINK, "inline-flex min-h-11 items-center text-[15px]")}>
                Más preguntas y contacto
              </Link>
            </div>
            <FaqAccordion className="mt-8" items={landingFaq} />
          </div>
        </div>
      </Sheet>

      {/* CTA final: hoja pomelo con el logo dibujándose --------------------- */}
      <Sheet label="cta-t" className="bg-eco-pomelo text-eco-ink [--lp-pb:88px] md:[--lp-pb:128px]">
        <div aria-hidden className="lp-rings pointer-events-none absolute inset-0 rounded-t-[32px] [--lp-ring:rgb(16_22_47/0.08)] [--lp-rings-at:0%_100%]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-16">
          <InkMark size={136} />
          <div>
            <h2 id="cta-t" className={cn(H2, "max-w-[17ch] text-[40px] leading-[0.98] sm:text-[60px] lg:text-[76px]")}>
              La tienda la armás hoy. Lo que falta es tu primera venta.
            </h2>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={start}
                className="group inline-flex h-14 items-center gap-3 rounded-full bg-eco-ink pr-2 pl-7 text-[16px] font-semibold text-white transition-[background-color,transform] duration-[240ms] ease-eco-out hover:bg-eco-ink-2 active:scale-[0.98]"
              >
                {startLabel}
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-eco-pomelo text-eco-ink transition-transform duration-[420ms] ease-eco-spring group-hover:translate-x-1 group-hover:-rotate-45">
                  <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
              </Link>
              <p className="text-[15px] font-medium">14 días de Pro, sin tarjeta. Sin comisión por venta.</p>
            </div>
          </div>
        </div>
      </Sheet>
    </PlatformPage>
  );
}
