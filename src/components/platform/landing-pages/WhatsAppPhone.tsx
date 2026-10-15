import { buildOrderMessage } from "@/lib/store/whatsapp";
import { cn } from "@/lib/cn";

import { PhoneFrame } from "../landing/Frames";
import { SAMPLE_ORDER, sampleTotals } from "../landing/sample-order";

/**
 * El pedido #1042 tal como llega al WhatsApp del comercio: el texto sale de
 * `buildOrderMessage`, la misma función que usa la tienda, con la plantilla
 * de fábrica. Sin colores ni íconos de WhatsApp (nada de marcas ajenas en
 * gráficos): globo de marca sobre niebla, como en la landing.
 */
export function WhatsAppPhone({ orderUrl, className }: { orderUrl: string; className?: string }) {
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
    <figure className={cn("relative mx-auto w-full max-w-[340px]", className)}>
      <div aria-hidden className="absolute -bottom-8 -left-10 size-56 rounded-full bg-eco-durazno sm:size-64" />
      <PhoneFrame className="lp-tilt-r relative">
        <div className="flex min-h-[520px] flex-col bg-eco-niebla-2">
          <p className="flex items-center gap-2.5 border-b border-eco-line bg-eco-paper px-4 pt-7 pb-3 text-[13px] font-semibold text-eco-ink">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-eco-durazno text-[12px] font-semibold">
              RQ
            </span>
            <span className="min-w-0">
              {SAMPLE_ORDER.customer}
              <span className="block text-[11px] font-normal text-eco-text-muted">en tu WhatsApp</span>
            </span>
          </p>
          <div className="lp-rings flex-1 space-y-2 px-3 py-4 [--lp-rings-at:100%_100%]">
            <div className="eco-bubble w-[92%] bg-eco-paper px-3 py-2.5 text-[13px] leading-snug text-eco-ink shadow-[0_6px_16px_-10px_rgb(16_22_47/0.4)] [--eco-bubble-r:16px]">
              <p className="tnum break-words whitespace-pre-line">{message}</p>
              <p className="mt-1 text-right text-[11px] text-eco-text-muted">14:32</p>
            </div>
          </div>
          <p className="mx-3 mb-4 flex items-center gap-2 rounded-full bg-eco-paper px-3 py-2 text-[12px] text-eco-ink shadow-[0_0_0_1px_var(--eco-line)]">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-eco-pomelo" />
            Pedido #{SAMPLE_ORDER.number} registrado en tu panel
          </p>
        </div>
      </PhoneFrame>
      <figcaption className="sr-only">Así te llega a WhatsApp el pedido #{SAMPLE_ORDER.number} de {SAMPLE_ORDER.store}.</figcaption>
    </figure>
  );
}
