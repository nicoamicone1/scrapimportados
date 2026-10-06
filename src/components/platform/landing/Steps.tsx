import { Check, FileSpreadsheet, Link2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { DISPLAY } from "../brand";

/*
 * "Cómo funciona" en tres pasos, cada uno con su mini-demo visual hecha con
 * CSS (sin JS): el alta con el nombre y el rubro, el catálogo que entra desde
 * una planilla y el link compartido que trae el pedido. Escalonados (el del
 * medio baja) para que no sea una grilla de tarjetas iguales.
 */

const i = (n: number) => ({ "--i": n }) as CSSProperties;

function StepVisual({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-[212px] overflow-hidden rounded-[28px] p-5 sm:h-[232px]", className)}>
      {children}
    </div>
  );
}

function CreateVisual({ address }: { address: string }) {
  return (
    <StepVisual className="bg-eco-paper shadow-[0_0_0_1px_var(--eco-line)]">
      <p className="text-[12px] font-semibold text-eco-text-muted">Nombre de tu tienda</p>
      <p className={cn(DISPLAY, "mt-1.5 flex h-12 items-center rounded-[12px] border-2 border-eco-ink px-3.5 text-[19px] text-eco-ink")}>
        Tienda Luna
        <span className="ml-0.5 h-6 w-[2px] animate-pulse bg-eco-azul" />
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5 text-[12px] font-medium">
        <span className="inline-flex items-center gap-1 rounded-full bg-eco-ink px-2.5 py-1 text-white">
          <Check className="size-3 text-eco-pomelo" strokeWidth={2.5} />
          Moda
        </span>
        <span className="rounded-full border border-eco-line px-2.5 py-1 text-eco-text-muted">Artesanías</span>
        <span className="rounded-full border border-eco-line px-2.5 py-1 text-eco-text-muted">Librería</span>
      </div>
      <p className="eco-reveal mt-5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-eco-azul-soft px-3 py-1.5 text-[12px] font-medium text-eco-azul-dark">
        <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{address}</span>
      </p>
    </StepVisual>
  );
}

const CSV_ROWS = [
  { name: "Remera oversize negra · M", price: 18900, stock: "14" },
  { name: "Pantalón wide beige · 38", price: 26500, stock: "3" },
  { name: "Buzo de frisa gris · L", price: 32400, stock: "8" },
  { name: "Vestido de lino · S", price: 29800, stock: "5" },
];

function CatalogVisual() {
  return (
    <StepVisual className="bg-eco-durazno">
      <p className="inline-flex items-center gap-2 rounded-full bg-eco-paper px-3 py-1.5 text-[12px] font-semibold text-eco-ink">
        <FileSpreadsheet className="size-4 text-eco-pomelo-ink" strokeWidth={1.75} />
        lista-de-precios.csv
        <span className="font-normal text-eco-text-muted">· 128 filas</span>
      </p>
      <ul className="mt-3 space-y-1.5">
        {CSV_ROWS.map((r, n) => (
          <li
            key={r.name}
            className="eco-reveal flex items-center gap-2.5 rounded-[14px] bg-eco-paper px-2.5 py-1.5 text-[12px] text-eco-ink shadow-[0_6px_14px_-10px_rgb(16_22_47/0.4)]"
            style={{ ...i(n), marginLeft: n % 2 ? 14 : 0 }}
          >
            <span className="size-7 shrink-0 rounded-[8px] bg-eco-niebla-2" />
            <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
            <span className="tnum">{formatMoney(r.price)}</span>
            <span className="tnum w-6 text-right text-eco-text-muted">{r.stock}</span>
          </li>
        ))}
      </ul>
    </StepVisual>
  );
}

function ShareVisual({ address }: { address: string }) {
  return (
    <StepVisual className="bg-eco-ink text-eco-mist">
      <div className="flex items-center gap-3">
        <span className="size-11 shrink-0 rounded-full bg-[conic-gradient(var(--eco-pomelo),var(--eco-durazno),var(--eco-pomelo))] p-[2px]">
          <span className="block size-full rounded-full border-2 border-eco-ink bg-eco-durazno" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-semibold text-white">tiendaluna</span>
          <span className="block text-[12px] text-eco-bruma">Ropa de mujer · Tucumán</span>
        </span>
      </div>
      <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-eco-ink-3 px-3 py-1.5 text-[12px] font-medium text-eco-azul-light">
        <Link2 className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">{address}</span>
      </p>
      <div className="eco-reveal eco-bubble mt-4 w-[88%] bg-eco-paper px-3 py-2 text-[12px] leading-snug text-eco-ink [--eco-bubble-r:16px]">
        <span className="font-semibold">Pedido #1043</span> en Tienda Luna
        <span className="tnum block text-eco-text-muted">2 productos · Total: {formatMoney(31400)}</span>
      </div>
      <span className="eco-reveal absolute right-5 bottom-5 flex size-8 items-center justify-center rounded-full bg-eco-pomelo text-[12px] font-bold text-eco-ink">1</span>
    </StepVisual>
  );
}

export interface StepCopy {
  title: string;
  text: ReactNode;
  time: string;
}

export function Steps({ steps, address }: { steps: readonly [StepCopy, StepCopy, StepCopy]; address: string }) {
  const visuals = [<CreateVisual key="c" address={address} />, <CatalogVisual key="v" />, <ShareVisual key="s" address={address} />];
  return (
    <ol className="grid gap-12 md:grid-cols-3 md:gap-6 lg:gap-10">
      {steps.map((step, n) => (
        <li key={step.title} className={cn("eco-reveal min-w-0", n === 1 && "md:mt-16", n === 2 && "md:mt-8")}>
          {visuals[n]}
          <div className="mt-6 flex items-start gap-4">
            <span className={cn(DISPLAY, "eco-bubble flex size-12 shrink-0 items-center justify-center bg-eco-pomelo text-[22px] text-eco-ink [--eco-bubble-r:18px]")} aria-hidden>
              {n + 1}
            </span>
            <div className="min-w-0">
              <h3 className={cn(DISPLAY, "text-[22px] leading-tight text-eco-ink")}>{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-eco-text-muted">{step.text}</p>
              <p className="mt-3 inline-flex rounded-full bg-eco-paper px-3 py-1 text-[13px] text-eco-ink shadow-[0_0_0_1px_var(--eco-line)]">
                <span className="font-semibold">Lleva:</span>&nbsp;{step.time}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
