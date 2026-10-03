"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

/**
 * Número que se desliza hasta su valor nuevo (≤ 600 ms, curva de salida de
 * la marca). Sólo en la landing (BRAND §9: en el panel los números no
 * cuentan). Con movimiento reducido salta directo. El primer render es el
 * valor final, así que el HTML del server ya trae el número correcto.
 */
export function useTweened(value: number, duration = 560): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      from.current = value;
      frame.current = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame.current);
    }
    const t0 = performance.now();
    // cubic-bezier(.22,1,.36,1) aproximada con una salida quíntica.
    const ease = (t: number) => 1 - (1 - t) ** 5;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = start + (value - start) * ease(t);
      from.current = v;
      setShown(v);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return shown;
}

/** Monto en pesos que se desliza (`$ 18.900`), con cifras tabulares. */
export function TweenMoney({ value, className }: { value: number; className?: string }) {
  const v = useTweened(value);
  return <span className={cn("tnum", className)}>{formatMoney(Math.round(v))}</span>;
}

/** Entero que se desliza (stock, unidades). */
export function TweenInt({ value, className }: { value: number; className?: string }) {
  const v = useTweened(value, 420);
  return <span className={cn("tnum", className)}>{Math.round(v).toLocaleString("es-AR")}</span>;
}
