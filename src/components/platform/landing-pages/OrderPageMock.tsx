import { Copy } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { PhoneFrame } from "../landing/Frames";
import { SAMPLE_ORDER, sampleTotals } from "../landing/sample-order";

/**
 * La página del pedido que ve la clienta después de confirmar con
 * transferencia (`/pedido/<token>`), con los mismos textos que la real:
 * "Transferí $ X", los datos para copiar, hasta cuándo se reserva el stock
 * y "Enviar comprobante por WhatsApp". Maqueta: `role="img"` con su
 * descripción; el texto de al lado cuenta lo mismo.
 */
export function OrderPageMock({ className }: { className?: string }) {
  const { total } = sampleTotals();
  const rows: [string, string, boolean][] = [
    ["Monto a transferir", formatMoney(total), true],
    ["Alias", "luna.indumentaria", true],
    ["Titular", SAMPLE_ORDER.store, false],
  ];
  return (
    <div
      role="img"
      aria-label={`Página del pedido #${SAMPLE_ORDER.number}: transferí ${formatMoney(total)}, alias para copiar, stock reservado hasta el jueves a las 18 y botón para enviar el comprobante por WhatsApp`}
      className={cn("relative mx-auto w-full max-w-[330px]", className)}
    >
      <div aria-hidden className="absolute -top-6 -right-8 size-48 rounded-full bg-eco-pomelo-soft" />
      <PhoneFrame className="lp-tilt-l relative">
        <div className="min-h-[470px] bg-eco-paper px-4 pt-8 pb-5 text-eco-ink">
          <p className="text-center text-[12px] font-semibold tracking-[0.14em] uppercase">{SAMPLE_ORDER.store}</p>
          <p className="mt-5 text-[19px] leading-tight font-semibold">Recibimos tu pedido #{SAMPLE_ORDER.number}</p>
          <p className="mt-1 text-[12px] text-eco-text-muted">Pendiente de pago</p>
          <div className="mt-4 rounded-[16px] border border-eco-line p-3.5">
            <p className="tnum text-[15px] font-semibold">Transferí {formatMoney(total)}</p>
            <p className="mt-1 text-[11.5px] leading-snug text-eco-text-muted">
              Poné <strong className="text-eco-ink">#{SAMPLE_ORDER.number}</strong> en el concepto de la transferencia.
            </p>
            <dl className="mt-3 space-y-1.5">
              {rows.map(([label, value, copy]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-[10px] bg-eco-niebla px-2.5 py-1.5">
                  <dt className="text-[10.5px] text-eco-text-muted">{label}</dt>
                  <dd className="tnum flex min-w-0 items-center gap-1.5 text-[12px] font-medium">
                    <span className="truncate">{value}</span>
                    {copy ? <Copy className="size-3.5 shrink-0 text-eco-azul" strokeWidth={1.75} /> : null}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11.5px] leading-snug">
              Te reservamos el stock hasta el <strong>jueves 16/10, 18:00</strong>. Si no registramos el pago para esa fecha, el pedido se cancela solo.
            </p>
            <p className="mt-3 flex h-10 items-center justify-center rounded-full bg-eco-ink text-[12.5px] font-semibold text-white">Enviar comprobante por WhatsApp</p>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}
