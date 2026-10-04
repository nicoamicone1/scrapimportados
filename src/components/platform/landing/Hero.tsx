import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { buildOrderMessage } from "@/lib/store/whatsapp";

import { CTA_ARROW, CTA_PRIMARY, H1, TEXT_LINK } from "../brand";

import { BrowserFrame, PhoneFrame } from "./Frames";
import { SHOTS } from "./shots";

/** El pedido de ejemplo de toda la landing (#1042): mismos números en el chat, el recibo y el checkout. */
export const SAMPLE_ORDER = {
  number: 1042,
  store: "Taller Luna",
  customer: "Rosa Quiroga",
  items: [
    { name: "Jarra de cerámica esmaltada 1 L", qty: 1, total: 18900 },
    { name: "Set 4 tazas de gres", qty: 1, total: 26500 },
  ],
  transferPercent: 10,
  shipping: { label: "Envío CABA", price: 3200, line: "Envío a Av. Corrientes 4120, CABA" },
};

export function sampleTotals() {
  const subtotal = SAMPLE_ORDER.items.reduce((a, i) => a + i.total, 0);
  const discount = Math.round((subtotal * SAMPLE_ORDER.transferPercent) / 100);
  return { subtotal, discount, total: subtotal - discount + SAMPLE_ORDER.shipping.price };
}

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * Hero: el dolor concreto, la promesa en una línea, UNA acción de marca con
 * la reversión de riesgo pegada, y a la derecha el producto funcionando: la
 * tienda real (captura) en un marco con curva y, encima, el celular del
 * comerciante con el pedido entrando por WhatsApp (el mensaje lo arma
 * `buildOrderMessage`, el mismo que usa la tienda). Todo sobre un arco
 * durazno; las piezas flotan lento. Sin JS: todo se ve en su lugar.
 */
export function Hero({ startHref, startLabel, demoHref, demoAddress, orderUrl }: { startHref: string; startLabel: string; demoHref: string; demoAddress: string; orderUrl: string }) {
  const { total } = sampleTotals();
  const message = buildOrderMessage({
    number: SAMPLE_ORDER.number,
    storeName: SAMPLE_ORDER.store,
    customerName: SAMPLE_ORDER.customer,
    items: SAMPLE_ORDER.items,
    total,
    delivery: SAMPLE_ORDER.shipping.line,
    url: orderUrl,
  });

  return (
    <section className="lp-under-sheet relative overflow-x-clip [--lp-pb:72px] md:[--lp-pb:104px]">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
        {/* Texto ------------------------------------------------------- */}
        <div className="min-w-0">
          <p className="eco-pop inline-flex items-center gap-2 rounded-full bg-eco-paper py-1.5 pr-3.5 pl-2 text-[13px] font-medium text-eco-ink shadow-[0_0_0_1px_var(--eco-line)]">
            <span className="eco-bubble size-5 bg-eco-pomelo [--eco-bubble-r:8px]" aria-hidden />
            Tu ecommerce completo, sin comisión por venta
          </p>
          <h1 className={cn(H1, "eco-pop mt-6 max-w-[11ch] xl:text-[84px]")} style={i(1)}>
            Tu tienda online, lista para{" "}
            <span className="lp-mark">
              vender
              <svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden>
                <path d="M3 14 C 50 4, 140 2, 197 11" pathLength={1} fill="none" stroke="var(--eco-pomelo)" strokeWidth="7" strokeLinecap="round" className="eco-draw" />
              </svg>
            </span>
            .
          </h1>
          <p className="eco-pop mt-7 max-w-[36ch] text-[19px] leading-[1.35] text-eco-ink sm:text-[21px]" style={i(2)}>
            Catálogo con variantes y stock, carrito, envíos por zona y cobro con tarjeta o transferencia. Cada pedido queda en tu panel, con el total, el envío y la dirección.
          </p>
          <div className="eco-pop mt-9 flex flex-wrap items-center gap-x-6 gap-y-3" style={i(3)}>
            <Link href={startHref} className={cn(CTA_PRIMARY, "h-14 pl-7 text-[16px]")}>
              {startLabel}
              <span className={cn(CTA_ARROW, "size-10")}>
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
            </Link>
            <Link href={demoHref} className={cn(TEXT_LINK, "inline-flex min-h-11 items-center text-[15px]")}>
              Ver una tienda funcionando
            </Link>
          </div>
          <ul className="eco-pop mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-eco-ink" style={i(4)}>
            {["14 días de Pro, sin tarjeta", "Sin comisión por venta", "Después seguís en Free si querés"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 text-eco-pomelo-ink" strokeWidth={2.25} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Composición: tienda + celular con el pedido ----------------------- */}
        <div className="relative mx-auto aspect-[10/8.6] w-full max-w-[680px] min-w-0 xl:mr-[-24px]">
          <div aria-hidden className="absolute top-[4%] right-[-14%] aspect-square w-[82%] rounded-full bg-eco-durazno" />
          <div aria-hidden className="lp-rings absolute top-[-18%] right-[-34%] aspect-square w-[122%] rounded-full [--lp-ring:rgb(255_90_60/0.16)] [--lp-rings-at:50%_50%]" />

          <div className="eco-pop absolute top-[4%] left-0 w-[90%]" style={i(2)}>
            <div className="eco-float" style={i(1)}>
              <BrowserFrame
                shot={SHOTS.tiendaDemo}
                address={demoAddress}
                sizes="(min-width: 1024px) 620px, 90vw"
                preload
                className="lp-tilt-l"
              />
            </div>
          </div>

          {/* Toast del panel: el pedido nuevo (BRAND §10, pastilla tinta). */}
          <div className="eco-pop absolute bottom-[4%] left-[2%] z-20 sm:bottom-[8%] sm:left-[6%]" style={i(22)}>
            <p className="flex items-center gap-2.5 rounded-full bg-eco-ink py-2 pr-4 pl-2 text-[13px] text-eco-mist shadow-[0_18px_40px_-16px_rgb(16_22_47/0.6)] sm:text-[14px]">
              <span className="eco-bubble flex size-7 items-center justify-center bg-eco-pomelo text-[11px] font-bold text-eco-ink [--eco-bubble-r:10px]" aria-hidden>
                1
              </span>
              <span>
                Pedido nuevo <span className="tnum font-semibold text-white">#{SAMPLE_ORDER.number}</span>
                <span className="tnum max-sm:hidden"> · {formatMoney(total)}</span>
              </span>
            </p>
          </div>

          {/* Celular del comerciante: el pedido llega por WhatsApp. */}
          <div className="absolute right-[-1%] bottom-[-6%] z-10 w-[37%] max-w-[226px]">
            <div className="eco-float" style={i(3)}>
              <PhoneFrame className="lp-tilt-r aspect-[9/18.5]">
                <div className="flex h-full flex-col bg-eco-niebla-2 font-[family-name:var(--eco-font-text)]">
                  <div className="flex items-center gap-2 border-b border-eco-line bg-eco-paper px-3 pt-5 pb-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-eco-durazno text-[10px] font-semibold text-eco-ink" aria-hidden>
                      RQ
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-[12px] font-semibold text-eco-ink">{SAMPLE_ORDER.customer}</span>
                      <span className="block text-[10px] text-eco-text-muted">en tu WhatsApp</span>
                    </span>
                  </div>
                  <div className="relative flex-1 space-y-1.5 overflow-hidden p-2 text-[9.5px] leading-snug text-eco-ink sm:text-[10.5px]">
                    <div className="lp-typing-out absolute top-2 left-2" aria-hidden>
                      <span className="lp-typing eco-bubble inline-flex gap-1 bg-eco-paper px-3 py-2.5 text-eco-text-muted [--eco-bubble-r:14px]">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                    <div className="eco-pop eco-bubble w-[92%] bg-eco-paper px-2.5 py-2 shadow-[0_4px_10px_-8px_rgb(16_22_47/0.5)] [--eco-bubble-r:14px]" style={i(17)}>
                      <p className="whitespace-pre-line break-words">{message}</p>
                    </div>
                    <div className="eco-pop eco-bubble-r ml-auto w-[80%] bg-eco-durazno px-2.5 py-2 [--eco-bubble-r:14px]" style={i(30)}>
                      Gracias, Rosa. Ya lo veo en el panel: te paso el alias.
                    </div>
                    <div className="eco-pop eco-bubble w-[70%] bg-eco-paper px-2.5 py-2 shadow-[0_4px_10px_-8px_rgb(16_22_47/0.5)] [--eco-bubble-r:14px]" style={i(42)}>
                      Listo, ahí va el comprobante.
                      <span className="mt-1.5 flex items-center gap-1.5 rounded-[8px] bg-eco-niebla-2 px-2 py-1.5 font-medium">
                        <span className="size-3 rounded-[3px] bg-eco-pomelo" aria-hidden />
                        comprobante.pdf
                      </span>
                    </div>
                  </div>
                </div>
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
