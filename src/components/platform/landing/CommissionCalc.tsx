"use client";

import { useId, useState, type CSSProperties } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

import { DISPLAY } from "../brand";

import { TweenMoney } from "./Tween";

/** Escalones del slider de ventas: más finos abajo, donde está la mayoría de las pymes. */
const SALES_STEPS = [
  300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 8_000_000, 10_000_000,
  12_500_000, 15_000_000, 20_000_000, 30_000_000,
];
const DEFAULT_SALES = SALES_STEPS.indexOf(3_000_000);

const fill = (value: number, min: number, max: number) => ({ "--lp-fill": `${((value - min) / (max - min)) * 100}%` }) as CSSProperties;

/**
 * Calculadora de aversión a la pérdida: "si te cobraran un X % por venta,
 * esto se iría por mes y por año; con Ecommy se queda en tu cuenta".
 * Hipotética a propósito: no nombra plataformas ni afirma tarifas ajenas.
 * Tu costo con Ecommy es el plan fijo (si hay planes cargados lo muestra).
 */
export function CommissionCalc({ plan }: { plan: { name: string; price: number } | null }) {
  const [salesIdx, setSalesIdx] = useState(DEFAULT_SALES);
  const [pct, setPct] = useState(5);
  const id = useId();
  const sales = SALES_STEPS[salesIdx];
  const monthly = Math.round((sales * pct) / 100);
  const yearly = monthly * 12;

  return (
    <div className="rounded-[28px] bg-eco-ink-2 p-5 shadow-[0_0_0_1px_var(--eco-ink-3)] sm:p-7" style={{ "--lp-track": "var(--eco-ink-3)", "--lp-focus": "var(--eco-azul-light)" } as CSSProperties}>
      <p className="text-[12px] font-semibold tracking-[0.1em] text-eco-pomelo uppercase">Hacé la cuenta</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-sales`} className="text-[14px] text-eco-mist">
            Lo que vendés en un mes
          </label>
          <output htmlFor={`${id}-sales`} className={cn(DISPLAY, "tnum text-[20px] text-white")}>
            {formatMoney(sales)}
          </output>
        </div>
        <input
          id={`${id}-sales`}
          type="range"
          min={0}
          max={SALES_STEPS.length - 1}
          step={1}
          value={salesIdx}
          aria-valuetext={formatMoney(sales)}
          onChange={(e) => setSalesIdx(Number(e.target.value))}
          className="lp-range mt-1"
          style={fill(salesIdx, 0, SALES_STEPS.length - 1)}
        />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-pct`} className="text-[14px] text-eco-mist">
            Si te cobraran por cada venta
          </label>
          <output htmlFor={`${id}-pct`} className={cn(DISPLAY, "tnum text-[20px] text-white")}>
            {pct.toLocaleString("es-AR")} %
          </output>
        </div>
        <input
          id={`${id}-pct`}
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={pct}
          aria-valuetext={`${pct.toLocaleString("es-AR")} por ciento`}
          onChange={(e) => setPct(Number(e.target.value))}
          className="lp-range mt-1"
          style={fill(pct, 1, 10)}
        />
      </div>

      <div className="eco-bubble mt-6 bg-eco-pomelo p-5 text-eco-ink" aria-live="polite">
        <p className="text-[14px] font-medium">Se irían en comisiones</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <TweenMoney value={yearly} className={cn(DISPLAY, "text-[40px] leading-none sm:text-[52px]")} />
          <span className="text-[15px] font-semibold">por año</span>
        </p>
        <p className="tnum mt-2 text-[14px]">
          Son <TweenMoney value={monthly} className="font-semibold" /> cada mes. Con Ecommy, eso se queda en tu cuenta.
        </p>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-eco-bruma">
        {plan ? (
          <>
            Tu costo con Ecommy es el plan, fijo: {plan.name} sale <span className="tnum text-eco-mist">{formatMoney(plan.price)}</span> por mes,
            vendas lo que vendas.{" "}
          </>
        ) : (
          "Tu costo con Ecommy es el plan, fijo por mes, vendas lo que vendas. "
        )}
        Cuenta ilustrativa: si cobrás con tarjeta, Mercado Pago cobra su comisión aparte, como en cualquier lado.
      </p>
    </div>
  );
}
