import { Copy, Search, TrendingDown } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { DISPLAY } from "../brand";

import { SAMPLE_ORDER } from "./Hero";

/*
 * Escenas del panel que todavía no tienen captura (docs/PRODUCT-THESIS.md
 * §4.2 y §4.3): "Qué pasó esta semana" y "Respuestas listas". Mocks
 * tipográficos con los datos de la tienda de ejemplo (Taller Luna), sin JS
 * ni botones de verdad: son ilustraciones, así que van `aria-hidden` y el
 * texto de al lado cuenta lo mismo.
 */

const CARD = "rounded-[24px] bg-eco-paper p-5 shadow-[0_0_0_1px_var(--eco-line),0_30px_60px_-36px_rgb(16_22_47/0.4)] sm:p-6";

/** "Qué pasó esta semana": el número y, abajo, por qué. */
export function WeekScene() {
  const lines = [
    { k: "Producto", text: "Tazas vendió 31 % menos." },
    { k: "Precio", text: "Subiste los precios de Tazas un 12 % el martes." },
    { k: "Stock", text: "El set de 4 tazas de gres se quedó sin stock el jueves." },
  ];
  return (
    <div aria-hidden className={cn(CARD, "lp-tilt-l")}>
      <p className="text-[12px] font-semibold tracking-[0.08em] text-eco-text-muted uppercase">Qué pasó esta semana</p>
      <p className={cn(DISPLAY, "mt-2 flex items-start gap-2.5 text-[20px] leading-tight text-eco-ink sm:text-[22px]")}>
        <TrendingDown className="mt-0.5 size-5 shrink-0 text-eco-pomelo-ink" strokeWidth={1.75} />
        <span>
          Vendiste <span className="tnum">18 %</span> menos que la semana pasada.
        </span>
      </p>
      <ul className="mt-4 space-y-2">
        {lines.map((l) => (
          <li key={l.k} className="flex min-w-0 items-baseline gap-3 rounded-[14px] bg-eco-niebla px-3 py-2 text-[13px] leading-snug text-eco-ink">
            <span className="w-[78px] shrink-0 text-[11px] font-semibold tracking-[0.06em] text-eco-text-muted uppercase">{l.k}</span>
            <span className="tnum min-w-0">{l.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Respuestas listas": buscás el producto y copiás la respuesta armada. */
export function RepliesScene({ storeAddress }: { storeAddress: string }) {
  const [jarra] = SAMPLE_ORDER.items;
  return (
    <div aria-hidden className={cn(CARD, "lp-tilt-r")}>
      <p className="flex h-11 items-center gap-2 rounded-[12px] border-2 border-eco-ink px-3 text-[15px] text-eco-ink">
        <Search className="size-4 shrink-0 text-eco-text-muted" strokeWidth={1.75} />
        jarra
        <span className="h-5 w-[2px] bg-eco-azul" />
      </p>
      <div className="mt-3 flex min-w-0 items-center gap-3 rounded-[14px] bg-eco-niebla px-3 py-2.5 text-[13px] text-eco-ink">
        <span className="size-9 shrink-0 rounded-[10px] bg-eco-durazno" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{jarra.name}</span>
          <span className="tnum block text-eco-text-muted">
            Azul: 3 · Verde: sin stock · {formatMoney(jarra.total)}
          </span>
        </span>
      </div>
      <div className="eco-bubble-r mt-4 ml-auto w-[94%] bg-eco-durazno px-3.5 py-2.5 text-[13px] leading-snug text-eco-ink [--eco-bubble-r:16px]">
        Sí, tenemos la jarra de cerámica en azul. Sale <span className="tnum">{formatMoney(jarra.total)}</span>, con{" "}
        {SAMPLE_ORDER.transferPercent} % menos por transferencia. Podés comprarla acá: <span className="break-all">{storeAddress}/jarra</span>
      </div>
      <p className="mt-3 flex justify-end">
        <span className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-eco-ink px-3.5 text-[13px] font-medium text-white">
          <Copy className="size-3.5" strokeWidth={1.75} />
          Copiar respuesta
        </span>
      </p>
    </div>
  );
}
