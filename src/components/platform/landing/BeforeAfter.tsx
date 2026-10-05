import { ArrowDown, ArrowRight, Check, Paperclip } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { DISPLAY } from "../brand";

import { SAMPLE_ORDER, sampleTotals } from "./Hero";

/*
 * "Antes / Con Ecommy" (docs/PRODUCT-THESIS.md §4.4): el mismo pedido #1042
 * contado dos veces. A la izquierda, la operación de hoy: siete lugares
 * (Instagram, WhatsApp, la calculadora, la app del banco, la planilla, las
 * notas del celular y la memoria), en burbujas que no terminan de alinearse.
 * A la derecha, la de Ecommy: un circuito en orden que termina en "Hoy" y en
 * "Listo por hoy". Todo tipográfico y sin JS (BRAND §8, nivel 3): son listas
 * de verdad, así que un lector de pantalla las lee en orden.
 */

type Who = "client" | "you";

interface BeforeStep {
  tool: string;
  who: Who;
  text: string;
  attachment?: string;
  /** Números escritos a mano (calculadora, planilla). */
  numeric?: boolean;
}

function beforeSteps(total: number): BeforeStep[] {
  const [jarra, tazas] = SAMPLE_ORDER.items;
  return [
    { tool: "Instagram", who: "client", text: "Hola, ¿precio de la jarra?" },
    { tool: "WhatsApp", who: "client", text: "¿La tenés en azul? ¿Cuánto sale el envío a Almagro?" },
    {
      tool: "Calculadora",
      who: "you",
      numeric: true,
      text: `${formatMoney(jarra.total)} + ${formatMoney(tazas.total)} − ${SAMPLE_ORDER.transferPercent} % + ${formatMoney(SAMPLE_ORDER.shipping.price)} = ?`,
    },
    { tool: "WhatsApp", who: "you", text: `Son ${formatMoney(total)}. Te paso el alias.` },
    { tool: "App del banco", who: "you", text: "¿Ya entró la transferencia de Rosa?", attachment: "comprobante.jpg" },
    { tool: "Planilla", who: "you", numeric: true, text: "Fila 214 · Rosa Q. · jarra azul + tazas · pagó" },
    { tool: "Notas del celular", who: "you", text: "Mandar a Rosa: Corrientes 4120" },
    { tool: "Tu memoria", who: "you", text: "¿Qué tenía que mandar hoy?" },
  ];
}

const TILTS = ["-rotate-[1.2deg]", "rotate-[0.8deg]", "-rotate-[0.5deg]", "rotate-[1.4deg]", "-rotate-[1deg]", "rotate-[0.6deg]", "-rotate-[1.4deg]", "rotate-0"];

function Before({ total }: { total: number }) {
  const steps = beforeSteps(total);
  return (
    <div className="min-w-0 rounded-[28px] bg-eco-paper p-5 shadow-[0_0_0_1px_var(--eco-line)] sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={cn(DISPLAY, "text-[24px] leading-tight text-eco-ink sm:text-[28px]")}>Antes</h3>
        <p className="text-[13px] text-eco-text-muted">Siete lugares, todo a mano</p>
      </div>
      <ol className="mt-6 space-y-3.5">
        {steps.map((step, n) => {
          const last = n === steps.length - 1;
          return (
            <li key={n} className={cn("flex min-w-0 flex-col", step.who === "client" ? "items-start" : "items-end")}>
              <span className="px-1 text-[11px] font-semibold tracking-[0.08em] text-eco-text-muted uppercase">
                {step.tool}
                <span className="sr-only">{step.who === "client" ? ", tu cliente: " : ", vos: "}</span>
              </span>
              <span
                className={cn(
                  "mt-1 max-w-[88%] px-3.5 py-2 text-[14px] leading-snug break-words text-eco-ink [--eco-bubble-r:16px]",
                  step.who === "client" ? "eco-bubble bg-eco-niebla-2" : "eco-bubble-r bg-eco-niebla",
                  step.numeric && "tnum font-[family-name:var(--eco-font-mono)] text-[13px]",
                  last && "bg-eco-pomelo-soft font-semibold",
                  TILTS[n % TILTS.length],
                )}
              >
                {step.text}
                {step.attachment ? (
                  <span className="mt-1.5 flex items-center gap-1.5 rounded-[8px] bg-eco-paper px-2 py-1 text-[12px] font-medium text-eco-text-muted">
                    <Paperclip className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    {step.attachment}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AfterStep({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex min-w-0 gap-4">
      {/* Riel del circuito: un punto por paso, unidos por una línea. */}
      <span aria-hidden className="relative flex w-6 shrink-0 justify-center">
        <span className={cn("relative z-10 mt-1 flex size-6 items-center justify-center rounded-full", last ? "bg-eco-pomelo text-eco-ink" : "bg-eco-ink-3 text-eco-pomelo")}>
          <Check className="size-3.5" strokeWidth={2.5} />
        </span>
        {last ? null : <span className="absolute top-7 -bottom-5 w-[2px] bg-eco-ink-3" />}
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-eco-bruma uppercase">{label}</p>
        <div className="mt-1 text-[14px] leading-relaxed text-eco-mist">{children}</div>
      </div>
    </li>
  );
}

function After({ total }: { total: number }) {
  return (
    <div className="eco-bubble min-w-0 bg-eco-ink p-5 text-eco-mist shadow-[0_40px_80px_-40px_rgb(16_22_47/0.6)] [--eco-bubble-r:28px] sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={cn(DISPLAY, "text-[24px] leading-tight text-white sm:text-[28px]")}>Con Ecommy</h3>
        <p className="text-[13px] text-eco-bruma">Un solo lugar, el pedido ya armado</p>
      </div>
      <ol className="mt-6 space-y-5">
        <AfterStep label="Tu tienda">
          Rosa ve el precio, el stock en azul y el envío a Almagro, y arma el pedido sola.
        </AfterStep>
        <AfterStep label="Pedido registrado">
          <span className="eco-bubble mt-0.5 mb-2 inline-flex max-w-full flex-wrap items-baseline gap-x-2 bg-eco-paper px-3 py-1.5 text-[13px] text-eco-ink [--eco-bubble-r:14px]">
            <span className="font-semibold">Pedido #{SAMPLE_ORDER.number}</span>
            <span className="tnum">{formatMoney(total)}</span>
            <span className="text-eco-text-muted">Av. Corrientes 4120</span>
          </span>
          <span className="block">Te llega a WhatsApp armado y queda en tu panel, con número.</span>
        </AfterStep>
        <AfterStep label="Cobro">
          Paga por transferencia con {SAMPLE_ORDER.transferPercent} % menos o con Mercado Pago en cuotas. Mientras tanto, el stock queda
          reservado.
        </AfterStep>
        <AfterStep label="Hoy">
          <span className="mt-1 block rounded-[18px] bg-eco-paper p-3.5 text-eco-ink">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className={cn(DISPLAY, "text-[18px]")}>Hoy</span>
              <span className="tnum text-[13px] font-medium">3 para preparar · 2 por cobrar</span>
            </span>
            <span className="mt-2.5 flex min-w-0 items-center justify-between gap-3 border-t border-eco-line pt-2.5 text-[13px]">
              <span className="min-w-0 truncate">
                <span className="font-semibold">#{SAMPLE_ORDER.number}</span> {SAMPLE_ORDER.customer}
              </span>
              <span className="shrink-0 rounded-[8px] bg-eco-ink px-2.5 py-1 text-[12px] font-medium text-white">Confirmar pago</span>
            </span>
          </span>
          <span className="mt-2 block">Lo resolvés ahí mismo: confirmás el pago, pasás a preparación y avisás por WhatsApp.</span>
        </AfterStep>
        <AfterStep label="Al cerrar el día" last>
          <span className={cn(DISPLAY, "text-[20px] text-white")}>Listo por hoy.</span>
        </AfterStep>
      </ol>
    </div>
  );
}

export function BeforeAfter() {
  const { total } = sampleTotals();
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6">
      <div className="eco-reveal-left min-w-0">
        <Before total={total} />
      </div>
      <span aria-hidden className="eco-bubble mx-auto flex size-12 items-center justify-center bg-eco-pomelo text-eco-ink [--eco-bubble-r:18px]">
        <ArrowDown className="size-5 lg:hidden" strokeWidth={1.75} />
        <ArrowRight className="size-5 max-lg:hidden" strokeWidth={1.75} />
      </span>
      <div className="eco-reveal-right min-w-0">
        <After total={total} />
      </div>
    </div>
  );
}
