import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { DISPLAY } from "../brand";
import { sampleItemLabel, SAMPLE_ORDER, sampleTotals } from "../landing/sample-order";

/**
 * Recibo del pedido #1042 pagado por transferencia, con "Comisión de Ecommy
 * $ 0" (el mismo de la landing, copiado acá para no tocar su página). Los
 * números salen de `SAMPLE_ORDER`: son los mismos del chat, el checkout y
 * las respuestas listas.
 */
export function OrderTicket({ className }: { className?: string }) {
  const { subtotal, discount, total } = sampleTotals();
  return (
    <figure className={cn("relative mx-auto max-w-[420px]", className)}>
      <div aria-hidden className="absolute -top-8 -right-6 size-44 rounded-full bg-eco-pomelo sm:-right-10 sm:size-48" />
      <div className="lp-tilt-r relative">
        <div className="lp-ticket bg-eco-paper px-6 pt-6 text-eco-ink shadow-[0_40px_80px_-30px_rgb(16_22_47/0.55)] [border-start-end-radius:28px] [border-start-start-radius:28px]">
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
                    {item.qty} × {sampleItemLabel(item)}
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
  );
}
