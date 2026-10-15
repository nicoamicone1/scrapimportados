import { Bot, MessageCircle, Send } from "lucide-react";
import Link from "next/link";

import { DISPLAY, TEXT_LINK } from "@/components/platform/brand";
import { CATALOG_COMPARE, planLabel, WHATSAPP_FLOW, WHATSAPP_META, WHATSAPP_NOT, whatsappFaq } from "@/components/platform/landing-pages/content";
import { landingPageJsonLd, type Crumb } from "@/components/platform/landing-pages/jsonld";
import { landingMetadata } from "@/components/platform/landing-pages/metadata";
import { ClosingSheet, FaqSheet, FlowSteps, PageHero, SectionHead, Sheet, SourceList, VerifiedNote } from "@/components/platform/landing-pages/parts";
import { WhatsAppPhone } from "@/components/platform/landing-pages/WhatsAppPhone";
import { BrowserFrame } from "@/components/platform/landing/Frames";
import { CheckoutDemo } from "@/components/platform/landing/PanelDemos";
import { PanelHomeScene, RepliesScene } from "@/components/platform/landing/PanelScenes";
import { SAMPLE_ORDER } from "@/components/platform/landing/sample-order";
import { PlatformPage } from "@/components/platform/PlatformChrome";
import { demoStoreHref, exampleStoreAddress } from "@/components/platform/site";
import { JsonLd } from "@/components/store/JsonLd";
import { cn } from "@/lib/cn";
import { platformOrigin } from "@/lib/tenant/urls";

import { plansOrEmpty } from "../../_lib/public-site";

/*
 * /funciones/pedidos-por-whatsapp (MARKETING §6.2: «tienda online con
 * pedidos por whatsapp», «catálogo online para whatsapp», «carrito que
 * manda el pedido a whatsapp»). Cuenta el circuito real con las piezas de
 * la landing: el mensaje es el de `buildOrderMessage`, el mismo que arma la
 * tienda. Estática con revalidación (planes en caché, sin sesión).
 */
export const revalidate = 600;

export const metadata = landingMetadata(WHATSAPP_META);

const CRUMBS: Crumb[] = [
  { label: "Inicio", href: "/" },
  { label: "Pedidos por WhatsApp", href: WHATSAPP_META.path },
];

const NOT_ICONS = [Bot, Send, MessageCircle];

export default async function PedidosPorWhatsappPage() {
  const plans = await plansOrEmpty("pedidos-por-whatsapp");
  const demo = demoStoreHref();
  const luna = exampleStoreAddress("luna-indumentaria");
  const orderUrl = `https://${luna}/pedido/8f3k2`;
  const faq = whatsappFaq(plans);

  const jsonLd = landingPageJsonLd({
    origin: platformOrigin(),
    path: WHATSAPP_META.path,
    title: WHATSAPP_META.title,
    description: WHATSAPP_META.description,
    crumbs: CRUMBS,
    faq,
  });

  return (
    <PlatformPage signedIn={false} footerOverlap className="lp-page">
      <JsonLd data={jsonLd} />

      <PageHero
        crumbs={CRUMBS}
        eyebrow="Pedidos por WhatsApp"
        title="El pedido te llega a WhatsApp armado."
        lead={
          <p>
            Tu clienta elige talle y color en tu tienda, arma el pedido y elige entrega y pago. A tu WhatsApp llega con todo, y antes de abrir el
            chat ya tiene número y está en tu panel. Sin app que instalar, en todos los planes.
          </p>
        }
        demoHref={demo}
        visual={<WhatsAppPhone orderUrl={orderUrl} />}
      />

      {/* El circuito ------------------------------------------------------ */}
      <Sheet id="circuito" label="circuito-t" className="bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead eyebrow="Cómo funciona" id="circuito-t" title="Del «¿tenés en M?» al pedido registrado.">
            Seis pasos, y vos aparecés recién en el último. El checkout de esta sección es el de verdad: cambiá la entrega o el pago y mirá cómo
            cambia el mensaje.
          </SectionHead>
          <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <FlowSteps steps={WHATSAPP_FLOW} />
            <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
              <CheckoutDemo storeName={SAMPLE_ORDER.store} orderUrl={orderUrl} />
              <p className="mt-3 text-[13px] text-eco-text-muted">Checkout y mensaje de la tienda de ejemplo {SAMPLE_ORDER.store}. En todos los planes.</p>
            </div>
          </div>
        </div>
      </Sheet>

      {/* Lo que pasa después: Responder y Hoy ---------------------------- */}
      <Sheet id="despues" label="despues-t" className="bg-eco-niebla [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead eyebrow="Y después" id="despues-t" title="Las consultas siguen llegando. Las respondés en un toque.">
            La tienda no reemplaza el chat: lo ordena. Las preguntas que siguen entrando las contestás con la respuesta armada, y cada pedido te
            espera en el panel.
          </SectionHead>
          <div className="mt-14 grid gap-x-10 gap-y-16 lg:grid-cols-2">
            <article aria-labelledby="responder-t" className="eco-reveal min-w-0">
              <h3 id="responder-t" className={cn(DISPLAY, "text-[24px] leading-tight text-eco-ink sm:text-[28px]")}>
                Responder
              </h3>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-eco-text-muted">
                Te preguntan «¿tenés la remera negra en M?». Buscás el producto en el panel y copiás la respuesta con precio, stock por talle,
                descuento por transferencia y link. La mandás vos, desde tu WhatsApp.
              </p>
              <p className="mt-2 text-[13px] font-medium text-eco-pomelo-ink">{planLabel(plans, "orders.replies")}</p>
              <div className="mt-6 sm:pl-6">
                <RepliesScene storeAddress={luna} />
              </div>
            </article>
            <article aria-labelledby="hoy-t" className="eco-reveal min-w-0 lg:mt-20">
              <h3 id="hoy-t" className={cn(DISPLAY, "text-[24px] leading-tight text-eco-ink sm:text-[28px]")}>
                Hoy
              </h3>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-eco-text-muted">
                Al abrir el panel ves cuántos pagos tenés por confirmar y cuántos pedidos por preparar o despachar. Los resolvés ahí mismo: confirmás
                el pago, pasás a preparación y avisás por WhatsApp.
              </p>
              <p className="mt-2 text-[13px] font-medium text-eco-pomelo-ink">Todos los planes</p>
              <div className="relative mt-6">
                <BrowserFrame address="ecommy.app/admin" className="lp-tilt-l">
                  <PanelHomeScene />
                </BrowserFrame>
              </div>
            </article>
          </div>
          <p className="mt-14 text-[15px] text-eco-text-muted">
            Más en la ayuda:{" "}
            <Link href="/ayuda/responder-consultas-whatsapp" className={TEXT_LINK}>
              responder consultas de WhatsApp
            </Link>{" "}
            y la guía{" "}
            <Link href="/guias/vender-por-whatsapp-sin-perder-pedidos" className={TEXT_LINK}>
              vender por WhatsApp sin perder pedidos
            </Link>
            .
          </p>
        </div>
      </Sheet>

      {/* Frente al catálogo de WhatsApp Business -------------------------- */}
      <Sheet id="catalogo" label="catalogo-t" className="bg-eco-paper [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 md:pt-24">
          <SectionHead eyebrow="¿Y el catálogo de WhatsApp?" id="catalogo-t" title="Lo podés seguir usando. Esto es lo que suma la tienda.">
            El catálogo de WhatsApp Business muestra tus productos dentro del chat. La tienda resuelve lo que pasa después: el talle que queda, el
            envío y el pedido que no se pierde entre chats.
          </SectionHead>
          <VerifiedNote who="WhatsApp Business" className="mt-4" />
          <table role="table" aria-labelledby="catalogo-caption" className="mt-10 w-full border-collapse text-left max-md:block">
            <caption id="catalogo-caption" className="sr-only">
              Catálogo de WhatsApp Business y tienda con Ecommy, punto por punto
            </caption>
            <thead role="rowgroup" className="max-md:sr-only">
              <tr role="row" className="text-[12px] tracking-[0.06em] text-adm-fg-muted uppercase">
                <th role="columnheader" scope="col" className="w-[24%] px-4 pb-3 font-semibold">
                  Tema
                </th>
                <th role="columnheader" scope="col" className="w-[38%] px-4 pb-3 font-semibold">
                  Catálogo de WhatsApp Business
                </th>
                <th role="columnheader" scope="col" className="w-[38%] px-4 pb-3 font-semibold">
                  Tienda con Ecommy
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="max-md:block">
              {CATALOG_COMPARE.map((r) => (
                <tr
                  key={r.topic}
                  role="row"
                  className="border-t border-eco-line align-top max-md:mb-3 max-md:block max-md:rounded-[20px] max-md:border-0 max-md:bg-eco-niebla max-md:p-4"
                >
                  <th role="rowheader" scope="row" className="px-4 py-4 text-[15px] font-semibold text-eco-ink max-md:block max-md:p-0">
                    {r.topic}
                  </th>
                  <td role="cell" className="px-4 py-4 text-[15px] leading-relaxed text-eco-text-muted max-md:block max-md:px-0 max-md:pt-3 max-md:pb-0">
                    <span className="block text-[11px] font-semibold tracking-[0.08em] text-eco-text-muted uppercase md:hidden">Catálogo de WhatsApp</span>
                    {r.catalog}
                  </td>
                  <td role="cell" className="px-4 py-4 text-[15px] leading-relaxed text-eco-ink max-md:block max-md:px-0 max-md:pt-3 max-md:pb-0">
                    <span className="block text-[11px] font-semibold tracking-[0.08em] text-eco-pomelo-ink uppercase md:hidden">Tienda con Ecommy</span>
                    {r.ecommy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <SourceList ids={["wa-funciones"]} className="mt-10 border-t border-eco-line pt-8" />
        </div>
      </Sheet>

      {/* Lo que no hace --------------------------------------------------- */}
      <Sheet id="no-hace" label="no-hace-t" className="bg-eco-durazno [--lp-pb:96px] md:[--lp-pb:128px]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <SectionHead eyebrow="Para que no haya sorpresas" id="no-hace-t" title="Lo que no hace.">
            <span className="text-eco-ink">Ecommy arma el pedido y la respuesta. Lo que se manda por WhatsApp, lo mandás vos.</span>
          </SectionHead>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-3 lg:pt-10">
            {WHATSAPP_NOT.map((item, i) => {
              const Icon = NOT_ICONS[i] ?? Bot;
              return (
                <li key={item.title} className="eco-reveal min-w-0">
                  <span aria-hidden className="eco-bubble flex size-10 items-center justify-center bg-eco-ink text-eco-durazno [--eco-bubble-r:14px]">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold text-eco-ink">{item.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-eco-ink">{item.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Sheet>

      <FaqSheet
        items={faq}
        aside={
          <p className="mt-6 max-w-[36ch] text-[14px] leading-relaxed text-eco-text-muted">
            ¿Cobrás por transferencia? Mirá{" "}
            <Link href="/funciones/cobrar-por-transferencia" className={TEXT_LINK}>
              cómo funciona el cobro
            </Link>
            .
          </p>
        }
      />

      <ClosingSheet title="Pasanos tu Instagram. Te devolvemos la tienda con tus productos." demoHref={demo} />
    </PlatformPage>
  );
}
