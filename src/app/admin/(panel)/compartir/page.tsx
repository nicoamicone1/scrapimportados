import { Download, ExternalLink, Share2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { CopyButton, ShareOnboarding, WhatsAppShareLink } from "@/components/admin/share/CopyButton";
import { INSTAGRAM_BIO_MAX, shareMessages } from "@/components/admin/share/messages";
import { ShareTargetPicker } from "@/components/admin/share/ShareTargetPicker";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, Eyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/display";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, formatPercent } from "@/lib/money";
import { storeDisplayHost, storeHref, storeUrl } from "@/lib/tenant/urls";

import { getShareData } from "./data";

export const metadata: Metadata = { title: "Compartir" };

const TIPS: { title: string; body: string }[] = [
  { title: "En la bio de Instagram", body: "Pegá el link en los enlaces del perfil de Instagram (el texto de la bio no admite links)." },
  {
    title: "En WhatsApp Business",
    body: "Sumalo al mensaje de bienvenida y a una respuesta rápida (por ejemplo /catalogo) para contestar en dos toques.",
  },
  { title: "En el local", body: "Imprimí el QR y pegalo al lado de la caja o en la vidriera: quien pasa puede comprar después." },
  { title: "En el packaging", body: "Una tarjeta o un sticker con el QR en cada bolsa: la segunda compra suele salir de ahí." },
  { title: "En tu firma", body: "En el mail, en el perfil de Google de tu negocio y en cualquier red donde te busquen." },
  {
    title: "Si ya tenías otra tienda",
    body: "Avisá que te mudaste con un mensaje a tus clientes y redirigí desde el link viejo al nuevo. Si traés tu dominio, cargá las URLs viejas en Configuración › SEO e integraciones › Redirecciones.",
  },
];

/** "Compartí tu tienda": link, QR, mensajes listos y links por producto (activación, spec §14.3). */
export default async function SharePage() {
  const ctx = await requireAdmin();
  const d = await getShareData(ctx);
  const url = storeUrl(ctx.store);
  const host = storeDisplayHost(ctx.store);
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1C1917", light: "#FFFFFF" },
  });

  const messages = shareMessages({
    storeName: ctx.store.name,
    url,
    transferDiscount: d.transferDiscount,
    freeShippingFrom: d.freeShippingFrom,
    currency: d.currency,
  });
  const reply = messages.find((m) => m.id === "reply")?.text ?? url;

  const facts: string[] = [];
  if (d.transferDiscount > 0) facts.push(`${formatPercent(d.transferDiscount)} off por transferencia`);
  if (d.freeShippingFrom !== null) facts.push(`envío gratis desde ${formatMoney(d.freeShippingFrom, { currency: d.currency })}`);
  const noProducts = d.activeProducts === 0;

  return (
    <ShareOnboarding done={d.sharedDone}>
      <PageHeader
        title="Compartí tu tienda"
        section="marketing"
        icon={<Share2 />}
        description={`${host} · ${d.activeProducts.toLocaleString("es-AR")} ${d.activeProducts === 1 ? "producto activo" : "productos activos"}`}
      />

      {noProducts || d.maintenance ? (
        <div role="status" className="mb-4 rounded-adm border border-adm-accent-2/60 bg-adm-accent-2-soft px-4 py-3 text-[13px]">
          {noProducts ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="min-w-0 flex-1">
                <span className="font-medium">Tu tienda todavía no muestra productos.</span> Quien entre por el link va a ver la tienda
                vacía: publicá al menos uno antes de compartirla.
              </p>
              <div className="flex gap-2">
                <ButtonLink href="/admin/productos/nuevo" size="sm" variant="primary">
                  Cargar producto
                </ButtonLink>
                <ButtonLink href="/admin/importar" size="sm">
                  Importar catálogo
                </ButtonLink>
              </div>
            </div>
          ) : null}
          {d.maintenance ? (
            <p className={noProducts ? "mt-2 border-t border-adm-accent-2/40 pt-2" : undefined}>
              <span className="font-medium">Tu tienda está en modo mantenimiento:</span> quien entre ve el aviso en lugar del catálogo.{" "}
              <Link href="/admin/configuracion/seo#mantenimiento" className="font-medium text-adm-accent underline-offset-2 hover:underline">
                Desactivar mantenimiento
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Tu link + QR: lo principal de la pantalla. */}
      <Card className="grid md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 p-5">
          <Eyebrow>Tu link</Eyebrow>
          <p className="mt-1 text-[22px] leading-8 font-semibold tracking-[-0.01em] break-all text-adm-fg">{host}</p>
          <p className="mt-1 max-w-[56ch] text-[13px] text-adm-fg-muted">
            Es la dirección de tu tienda. Quien la abre ve el catálogo con precios y stock, y el pedido te llega registrado aunque lo
            cierren por WhatsApp.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <CopyButton text={url} label="Copiar link" ariaLabel="Copiar link de la tienda" variant="primary" size="md" />
            <ButtonLink href={storeHref(ctx.store)} external icon={<ExternalLink />}>
              Abrir tienda
            </ButtonLink>
            <WhatsAppShareLink text={reply} size="md" />
          </div>
        </div>
        <div className="flex gap-4 border-t border-adm-border p-5 md:flex-col md:items-center md:border-t-0 md:border-l">
          <div
            role="img"
            aria-label={`Código QR de ${host}`}
            className="size-[136px] shrink-0 rounded-adm border border-adm-border bg-white p-2.5 md:size-[168px] [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="min-w-0 md:w-[168px]">
            <a href="/admin/compartir/qr" download className={buttonClass("secondary", "sm", "w-full")}>
              <Download aria-hidden strokeWidth={1.5} />
              Descargar PNG
            </a>
            <p className="mt-2 text-[12px] leading-snug text-adm-fg-muted">
              1024 px, listo para imprimir. Imprimilo y pegalo en el mostrador o en el packaging.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <Card>
            <CardHeader
              title="Mensajes listos para pegar"
              description={
                facts.length ? (
                  <>Armados con los datos de tu tienda: {facts.join(" y ")}. Si los cambiás, los mensajes se actualizan solos.</>
                ) : (
                  <>
                    Si ofrecés descuento por transferencia (
                    <Link href="/admin/configuracion/pagos" className="text-adm-accent underline-offset-2 hover:underline">
                      Pagos
                    </Link>
                    ) o envío gratis desde un monto (
                    <Link href="/admin/envios" className="text-adm-accent underline-offset-2 hover:underline">
                      Envíos
                    </Link>
                    ), lo sumamos a los mensajes: es lo que más convence.
                  </>
                )
              }
            />
            <ul className="divide-y divide-adm-border">
              {messages.map((m) => (
                <li key={m.id} className="grid gap-x-6 gap-y-2 px-4 py-4 md:grid-cols-[200px_minmax(0,1fr)]">
                  <div>
                    <h3 className="text-[13px] font-medium text-adm-fg">{m.title}</h3>
                    <p className="mt-0.5 text-[12px] leading-snug text-adm-fg-muted">{m.hint}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="rounded-adm border border-adm-border bg-adm-surface-2 px-3 py-2 text-[13px] leading-relaxed break-words whitespace-pre-line text-adm-fg">
                      {m.text}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CopyButton text={m.text} ariaLabel={`Copiar mensaje: ${m.title}`} />
                      {m.id === "reply" ? <WhatsAppShareLink text={m.text} /> : null}
                      {m.id === "bio" ? (
                        <span className="tnum ml-auto text-[12px] text-adm-fg-muted">
                          {m.text.length} de {INSTAGRAM_BIO_MAX} caracteres
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Link para un producto o categoría"
              description="Cuando te preguntan por algo puntual, mandá directo a eso: un paso menos entre la pregunta y la compra."
            />
            {d.products.length || d.categories.length ? (
              <ShareTargetPicker storeName={ctx.store.name} currency={d.currency} initialProducts={d.products} categories={d.categories} />
            ) : (
              <div className="px-4 py-6">
                <p className="text-[13px] text-adm-fg-muted">
                  Cuando tengas productos activos vas a poder copiar el link de cada uno, con su precio, para mandarlo por WhatsApp.
                </p>
                <ButtonLink href="/admin/productos" size="sm" className="mt-3">
                  Ir a productos
                </ButtonLink>
              </div>
            )}
          </Card>
        </div>

        <section aria-labelledby="tips-title" className="lg:sticky lg:top-16 lg:col-span-4 lg:self-start">
          <h2 id="tips-title" className="text-[15px] font-semibold text-adm-fg">
            Dónde poner el link
          </h2>
          <p className="mt-0.5 text-[13px] text-adm-fg-muted">Seis lugares donde tus clientes ya te buscan.</p>
          <ol className="mt-3 space-y-3 border-l-2 border-adm-border pl-4">
            {TIPS.map((t) => (
              <li key={t.title} className="text-[13px] leading-relaxed">
                <span className="font-medium text-adm-fg">{t.title}.</span> <span className="text-adm-fg-muted">{t.body}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </ShareOnboarding>
  );
}
