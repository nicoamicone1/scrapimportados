import { ArrowRight, Landmark, Layers, MapPinned, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { preconnect } from "react-dom";

import { FaqList } from "@/components/platform/FaqList";
import { pickFaq, platformFaq } from "@/components/platform/faq";
import {
  CatalogMock,
  CheckoutMock,
  PricesMock,
  ShippingMock,
  STOREFRONT_MOCK_TEXTS,
  StorefrontMock,
} from "@/components/platform/LandingMocks";
import { PlanCards, PlanCtaLink } from "@/components/platform/PlanCards";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { PresetSpecimens, specimenPlanLabel } from "@/components/platform/PresetSpecimens";
import { exampleStoreAddress, PLATFORM_EMAIL } from "@/components/platform/site";
import { presetSpecimens, SPECIMEN_BUTTON, specimenFontsHref } from "@/components/platform/specimens";
import { JsonLd } from "@/components/store/JsonLd";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { listPublicPlans, type PublicPlan } from "@/lib/plans/catalog";
import { platformOrigin, storeHref } from "@/lib/tenant/urls";
import { PRESETS } from "@/lib/theme";
import { APP_NAME } from "@/lib/version";

const TITLE = "Ecommy · Tu tienda online, sin comisión por venta";
const DESCRIPTION =
  "Creá tu tienda online con catálogo, stock y carrito. Los pedidos te llegan armados por WhatsApp y cobrás por transferencia, sin pasarela ni comisión por venta. 14 días de Pro gratis, sin tarjeta.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/" },
};
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Contenido                                                            */
/* ------------------------------------------------------------------ */

const STEPS: { title: string; text: ReactNode; time: string }[] = [
  {
    title: "Creás la tienda",
    text: "Elegís nombre, dirección y rubro; el rubro define el estilo con el que arranca, y lo cambiás cuando quieras. Cargás el WhatsApp donde te llegan los pedidos y el alias o CBU para las transferencias.",
    time: "Unos 5 minutos: son 3 pasos.",
  },
  {
    title: "Cargás el catálogo",
    text: "A mano, con fotos, variantes de talle y color y stock por variante. Si lo tenés en una planilla, lo subís en CSV (desde Starter). Si ya vendés en WooCommerce, Shopify u otra web con datos de producto, lo importás pegando la dirección (Pro, incluido en la prueba): entra como borrador para que lo revises antes de publicar.",
    time: "Depende del catálogo. A mano, un par de minutos por producto; importado, lo que tardes en revisarlo.",
  },
  {
    title: "Compartís el link y cobrás",
    text: "Lo pegás en la bio de Instagram, en tus estados de WhatsApp o donde ya vendés. El cliente arma el carrito, elige envío o retiro y confirma: el pedido queda registrado con número y te llega por WhatsApp. Si paga por transferencia, ve tu alias y el descuento; vos lo marcás pagado cuando ves el comprobante.",
    time: "El mismo día que publicás.",
  },
];

const FEATURES: { icon: ReactNode; title: string; text: string; plans: string; mock: ReactNode }[] = [
  {
    icon: <Layers className="size-5" strokeWidth={1.5} aria-hidden />,
    title: "Tu catálogo, cargado en una tarde",
    text: "Productos con variantes de talle y color, fotos, stock por variante y categorías anidadas. Si ya lo tenés en una planilla o en otra tienda, lo importás y seguís desde ahí.",
    plans: "Variantes en todos los planes · planilla CSV desde Starter · importación desde otra web en Pro",
    mock: <CatalogMock />,
  },
  {
    icon: <Tags className="size-5" strokeWidth={1.5} aria-hidden />,
    title: "Precios que se actualizan en un paso",
    text: "Subí un 8 % a toda una categoría con redondeo y vista previa, y deshacelo si te equivocaste. Promos programadas por fecha y cupones con tope de usos.",
    plans: "Cupones en todos los planes · promos programadas desde Starter · precios masivos en Pro",
    mock: <PricesMock />,
  },
  {
    icon: <Landmark className="size-5" strokeWidth={1.5} aria-hidden />,
    title: "Cobrás como ya cobrás",
    text: "Sin pasarela ni comisión: transferencia con descuento o acordar por WhatsApp. El pedido queda registrado antes de derivar y te llega armado, con total y dirección.",
    plans: "En todos los planes",
    mock: <CheckoutMock />,
  },
  {
    icon: <MapPinned className="size-5" strokeWidth={1.5} aria-hidden />,
    title: "Envíos por zona, dibujadas en el mapa",
    text: "Marcá tu zona de reparto sobre el mapa, sumá provincias o códigos postales con su costo y plazo, y ofrecé retiro en tu local. El checkout calcula el envío solo.",
    plans: "En todos los planes",
    mock: <ShippingMock />,
  },
];

const ALSO: { title: string; text: string; plans: string }[] = [
  {
    title: "Ley argentina, resuelta",
    text: "Botón de arrepentimiento con registro de cada solicitud, precio sin impuestos nacionales (Ley 27.743), Data Fiscal de ARCA y el aviso de Defensa del Consumidor en el pie de la tienda.",
    plans: "Todos los planes",
  },
  {
    title: "SEO técnico",
    text: "Sitemap y robots por tienda, título y descripción editables, imagen para compartir en redes, datos estructurados de producto (JSON-LD) y redirecciones 301 desde las direcciones de tu tienda anterior.",
    plans: "Todos los planes",
  },
  {
    title: "Mudanza desde otra tienda",
    text: "Importás desde WooCommerce, Shopify o webs con datos schema.org, con recargo y redondeo sobre el precio de origen, y volvés a sincronizar cuando cambian los precios.",
    plans: "Pro",
  },
  {
    title: "Equipo y auditoría",
    text: "Sumás usuarios con permisos por rol y cada cambio queda registrado: quién tocó qué precio y cuándo.",
    plans: "Equipo desde Starter · auditoría en Pro",
  },
  {
    title: "Páginas por bloques",
    text: "Armás el inicio y landings de campaña con bloques (portada, banners, grillas y sliders de productos, preguntas frecuentes, cuenta regresiva) sin tocar código.",
    plans: "Inicio en todos los planes · landings desde Starter",
  },
];

/** Ejemplo del recibo: mismos números que el mock del pedido #1042. */
const ORDER = {
  items: [
    { name: "Jarra de cerámica esmaltada 1 L", price: 18900 },
    { name: "Set 4 tazas de gres", price: 26500 },
  ],
  transferPercent: 10,
  shipping: { label: "Envío CABA", price: 3200 },
};

async function plansOrEmpty(): Promise<PublicPlan[]> {
  try {
    return await listPublicPlans();
  } catch (err) {
    console.error("[landing] planes:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** "Nórdico y Mercado". */
function listNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : (names[0] ?? "");
}

/* ------------------------------------------------------------------ */
/* Página                                                               */
/* ------------------------------------------------------------------ */

export default async function LandingPage() {
  const [{ user }, plans] = await Promise.all([getSession(), plansOrEmpty()]);
  const signedIn = Boolean(user);
  const start = signedIn ? "/app/nueva" : "/registro";
  const demo = storeHref({ slug: "demo" });

  const specimens = presetSpecimens();
  const planLabels = specimens.map((s) => specimenPlanLabel(plans, s));
  const freeNames = specimens.filter((_, i) => planLabels[i]?.startsWith("Incluido")).map((s) => s.presetName);
  const fontsHref = specimenFontsHref(
    [...specimens.map((s) => s.theme), PRESETS.mercado],
    [
      ...specimens.flatMap((s) => [s.label, s.hint, s.presetName, s.product.name, formatMoney(s.product.price), formatMoney(s.product.compareAt)]),
      ...planLabels.flatMap((l) => (l ? [` · ${l}`] : [])),
      SPECIMEN_BUTTON,
      ...STOREFRONT_MOCK_TEXTS,
    ],
  );
  preconnect("https://fonts.googleapis.com");
  preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });

  const faq = platformFaq({ storeAddress: exampleStoreAddress() });
  const landingFaq = pickFaq(faq, ["comision", "tarjeta", "prueba", "mudanza", "datos", "facturacion"]);

  const subtotal = ORDER.items.reduce((sum, i) => sum + i.price, 0);
  const discount = Math.round((subtotal * ORDER.transferPercent) / 100);
  const total = subtotal - discount + ORDER.shipping.price;
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
    <PlatformPage signedIn={signedIn}>
      <JsonLd data={jsonLd} />
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}

      {/* Hero ----------------------------------------------------------- */}
      <section className="border-b border-adm-border bg-adm-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-14 sm:px-6 md:pt-16 md:pb-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Tiendas online para pymes argentinas</p>
            <h1 className="mt-4 max-w-[12ch] text-[40px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[52px] lg:text-[60px]">
              Dejá de pasar precios por privado.
            </h1>
            <p className="mt-5 max-w-[34ch] text-[19px] leading-snug tracking-[-0.01em] sm:text-[21px]">
              Tu tienda con catálogo, stock y carrito. El cliente confirma y el pedido te llega por WhatsApp con el total y la dirección.
            </p>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-adm-fg-muted">
              Cobrás por transferencia o como lo acuerden: sin pasarela y sin comisión por venta. Empezás con 14 días de Pro gratis, sin
              tarjeta.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href={start}
                className="inline-flex h-11 items-center gap-2 rounded-adm bg-adm-accent px-5 text-[15px] font-medium text-adm-accent-fg transition-colors hover:bg-adm-accent-hover"
              >
                Crear tu tienda gratis
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </Link>
              <Link href={demo} className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
                Ver la tienda demo
              </Link>
            </div>
            <dl className="mt-10 grid max-w-[500px] grid-cols-3 border-t border-adm-border pt-5 text-[13px]">
              <div className="pr-3">
                <dt className="text-adm-fg-muted">Plan Free</dt>
                <dd className="tnum mt-0.5 text-[17px] font-semibold">{formatMoney(0)}</dd>
              </div>
              <div className="border-l border-adm-border px-3 sm:px-4">
                <dt className="text-adm-fg-muted">Comisión por venta</dt>
                <dd className="tnum mt-0.5 text-[17px] font-semibold">0 %</dd>
              </div>
              <div className="border-l border-adm-border pl-3 sm:pl-4">
                <dt className="text-adm-fg-muted">Estilos por rubro</dt>
                <dd className="tnum mt-0.5 text-[17px] font-semibold">{specimens.length}</dd>
              </div>
            </dl>
          </div>
          <StorefrontMock address={exampleStoreAddress("taller-luna")} className="w-full max-w-[540px] justify-self-center lg:justify-self-end" />
        </div>
      </section>

      {/* Cómo funciona -------------------------------------------------- */}
      <section id="como-funciona" aria-labelledby="como-funciona-t" className="scroll-mt-4">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Cómo funciona</p>
            <h2 id="como-funciona-t" className="mt-3 max-w-[16ch] text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[36px]">
              De cero a tu primer pedido, en una tarde.
            </h2>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-adm-fg-muted">
              Con un catálogo chico, sin diseñador ni programador. Lo que necesitás tener a mano: fotos, precios, talles y tu alias.
            </p>
          </div>
          <ol className="border-b border-adm-border">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-t border-adm-border py-6 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                <span className="tnum text-[28px] leading-none font-light tracking-[-0.03em] text-adm-accent sm:text-[36px]" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[18px] leading-snug font-semibold tracking-[-0.01em]">{step.title}</h3>
                  <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-adm-fg-muted">{step.text}</p>
                  <p className="mt-3 text-[13px]">
                    <span className="font-medium">Lleva:</span> {step.time}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Para quién ----------------------------------------------------- */}
      <section id="rubros" aria-labelledby="rubros-t" className="scroll-mt-4 border-y border-adm-border bg-adm-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
            <div>
              <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2-ink uppercase">Para quién</p>
              <h2 id="rubros-t" className="mt-3 max-w-[20ch] text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[36px]">
                Un estilo para cada rubro, no una plantilla para todos.
              </h2>
            </div>
            <p className="max-w-[48ch] text-[15px] leading-relaxed text-adm-fg-muted">
              Al crear la tienda elegís el rubro y arranca con su estilo: tipografías, colores, forma de las fotos, densidad de la grilla y
              botones. Estas muestras están dibujadas con los estilos reales.
              {freeNames.length ? ` Free incluye ${listNames(freeNames)}; en la prueba de 14 días usás los ${specimens.length}.` : null}
            </p>
          </div>
          <PresetSpecimens className="mt-10" specimens={specimens} plans={plans} />
          <p className="mt-5 text-[13px] text-adm-fg-muted">
            ¿Tu rubro no está? Arrancás con Nórdico, el más neutro, y ajustás colores y tipografías desde el panel.{" "}
            <Link href={demo} className="font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
              Ver una tienda funcionando
            </Link>
          </p>
        </div>
      </section>

      {/* Features ------------------------------------------------------- */}
      <section aria-labelledby="panel-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 id="panel-t" className="max-w-[22ch] text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[36px]">
            Lo que hacés todos los días, en un panel pensado para eso.
          </h2>
          <div className="mt-12 space-y-14 md:space-y-16">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
                <div className={i % 2 ? "md:order-2" : undefined}>
                  <h3 className="flex items-center gap-2.5 text-[18px] font-semibold tracking-[-0.01em]">
                    <span className="text-adm-accent">{f.icon}</span>
                    {f.title}
                  </h3>
                  <p className="mt-2 max-w-[48ch] text-[14px] leading-relaxed text-adm-fg-muted">{f.text}</p>
                  <p className="mt-3 text-[12px] text-adm-fg-muted">{f.plans}</p>
                </div>
                <div className={i % 2 ? "md:order-1" : undefined}>{f.mock}</div>
              </div>
            ))}
          </div>

          <div className="mt-20 grid gap-8 border-t-2 border-adm-fg pt-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">Y lo que no se ve, también.</h3>
            <dl>
              {ALSO.map((a) => (
                <div
                  key={a.title}
                  className="grid gap-x-8 gap-y-1 border-b border-adm-border py-4 first:pt-0 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
                >
                  <dt className="text-[14px] font-semibold">{a.title}</dt>
                  <dd className="text-[14px] leading-relaxed text-adm-fg-muted">
                    {a.text}
                    <span className="mt-1 block text-[12px]">{a.plans}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Sin comisiones ------------------------------------------------- */}
      <section aria-labelledby="comision-t" className="bg-adm-sidebar-bg text-adm-sidebar-fg">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <p className="text-[12px] font-medium tracking-[0.08em] text-adm-accent-2 uppercase">Sin pasarela, sin comisión</p>
            <h2 id="comision-t" className="mt-3 max-w-[18ch] text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] sm:text-[40px]">
              Te pagan a vos. Ecommy no toca la plata.
            </h2>
            <p className="mt-5 max-w-[56ch] text-[15px] leading-relaxed text-adm-sidebar-fg">
              Las plataformas con pasarela de pago integrada cobran un porcentaje de cada venta, además del plan. Acá no hay pasarela: el
              cliente te transfiere a tu cuenta o lo arreglan por WhatsApp, y Ecommy no cobra nada por venta. Tu costo es el plan, fijo por
              mes.
            </p>
            <h3 className="mt-10 text-[14px] font-semibold">Lo que tenés que saber</h3>
            <ul className="mt-3 max-w-[56ch] space-y-3 text-[14px] leading-relaxed text-adm-sidebar-muted">
              <li className="border-l-2 border-adm-sidebar-border pl-4">
                No hay cobro con tarjeta dentro de la tienda. Si alguien quiere pagar así, le mandás un link de pago de tu billetera por
                WhatsApp.
              </li>
              <li className="border-l-2 border-adm-sidebar-border pl-4">
                El pago lo confirmás vos al ver el comprobante. Mientras tanto, el pedido reserva el stock por las horas que definas; si no se
                paga, se libera solo.
              </li>
              <li className="border-l-2 border-adm-sidebar-border pl-4">
                Si tu banco o tu billetera cobran algo por recibir transferencias, eso es aparte y lo ves con ellos.
              </li>
            </ul>
          </div>

          <figure className="self-start rounded-adm bg-adm-surface p-5 text-adm-fg sm:p-6">
            <figcaption className="flex items-baseline justify-between gap-3 border-b border-dashed border-adm-input-border pb-3">
              <span className="text-[14px] font-semibold">Pedido #1042</span>
              <span className="text-[12px] text-adm-fg-muted">Pago por transferencia</span>
            </figcaption>
            <table className="mt-3 w-full text-[13px]">
              <caption className="sr-only">Ejemplo de un pedido pagado por transferencia</caption>
              <tbody>
                {ORDER.items.map((item) => (
                  <tr key={item.name}>
                    <th scope="row" className="py-1 pr-3 text-left font-normal">
                      1 × {item.name}
                    </th>
                    <td className="py-1 text-right">{formatMoney(item.price)}</td>
                  </tr>
                ))}
                <tr className="border-t border-adm-border">
                  <th scope="row" className="pt-2 pb-1 pr-3 text-left font-normal text-adm-fg-muted">
                    Subtotal
                  </th>
                  <td className="pt-2 pb-1 text-right">{formatMoney(subtotal)}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-1 pr-3 text-left font-normal text-adm-fg-muted">
                    Descuento por transferencia ({ORDER.transferPercent} %)
                  </th>
                  <td className="py-1 text-right">− {formatMoney(discount)}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-1 pr-3 text-left font-normal text-adm-fg-muted">
                    {ORDER.shipping.label}
                  </th>
                  <td className="py-1 text-right">{formatMoney(ORDER.shipping.price)}</td>
                </tr>
                <tr className="border-t border-adm-border">
                  <th scope="row" className="pt-2 pb-1 pr-3 text-left font-normal">
                    Paga el cliente
                  </th>
                  <td className="pt-2 pb-1 text-right">{formatMoney(total)}</td>
                </tr>
                <tr>
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    Comisión de Ecommy
                  </th>
                  <td className="py-1 text-right">{formatMoney(0)}</td>
                </tr>
                <tr className="border-t-2 border-adm-fg">
                  <th scope="row" className="pt-2.5 pr-3 text-left text-[15px] font-semibold">
                    Llega a tu cuenta
                  </th>
                  <td className="pt-2.5 text-right text-[18px] font-semibold tracking-[-0.01em]">{formatMoney(total)}</td>
                </tr>
              </tbody>
            </table>
            {refPlan?.priceMonthly ? (
              <p className="mt-5 border-t border-dashed border-adm-input-border pt-4 text-[13px] leading-relaxed text-adm-fg-muted">
                Tu costo fijo es el plan: {refPlan.name} sale <span className="tnum text-adm-fg">{formatMoney(refPlan.priceMonthly)}</span> por
                mes. Con 30 pedidos en el mes son <span className="tnum text-adm-fg">{formatMoney(Math.round(refPlan.priceMonthly / 30))}</span>{" "}
                por pedido; con 100, <span className="tnum text-adm-fg">{formatMoney(Math.round(refPlan.priceMonthly / 100))}</span>.
              </p>
            ) : null}
          </figure>
        </div>
      </section>

      {/* Planes --------------------------------------------------------- */}
      {plans.length ? (
        <section id="planes" aria-labelledby="planes-t" className="scroll-mt-4 bg-adm-surface-2/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="planes-t" className="text-[30px] leading-tight font-semibold tracking-[-0.025em]">
                  Planes
                </h2>
                <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-adm-fg-muted">
                  Toda tienda nueva arranca con 14 días de Pro. Después elegís: si no pagás nada, pasás a Free sin perder tus datos. Precios
                  finales en pesos, por mes y por tienda.
                </p>
              </div>
              <Link href="/planes#comparar" className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
                Comparar todo en detalle
              </Link>
            </div>
            <PlanCards
              className="mt-8"
              plans={plans}
              highlight="pro"
              renderCta={(plan) =>
                plan.code === "business" ? (
                  <PlanCtaLink href="/contacto">Hablemos</PlanCtaLink>
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

      {/* Preguntas ------------------------------------------------------ */}
      <section id="preguntas" aria-labelledby="preguntas-t" className="scroll-mt-4 border-t border-adm-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="preguntas-t" className="text-[30px] leading-tight font-semibold tracking-[-0.025em]">
              Preguntas frecuentes
            </h2>
            <Link href="/contacto" className="text-sm font-medium text-adm-accent underline underline-offset-4 hover:no-underline">
              Más preguntas y contacto
            </Link>
          </div>
          <FaqList className="mt-8" items={landingFaq} />
        </div>
      </section>

      {/* CTA final ------------------------------------------------------ */}
      <section className="border-t border-adm-border bg-adm-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end">
          <p className="max-w-[24ch] text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[36px]">
            La tienda la armás hoy. Lo que falta es tu primera venta.
          </p>
          <div>
            <Link
              href={start}
              className="inline-flex h-11 items-center gap-2 rounded-adm bg-adm-accent px-5 text-[15px] font-medium text-adm-accent-fg transition-colors hover:bg-adm-accent-hover"
            >
              Crear tu tienda gratis
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
            <p className="mt-3 text-[13px] text-adm-fg-muted">14 días de Pro gratis, sin tarjeta. Después seguís en Free si querés.</p>
          </div>
        </div>
      </section>
    </PlatformPage>
  );
}
