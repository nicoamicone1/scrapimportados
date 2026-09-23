"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";

/*
 * Barra de progreso de navegación (spec §14.5): 2 px arriba de todo.
 * - Arranca al hacer click en un <a> interno (mismo origen, sin target, sin
 *   modificadores, a otra URL) o con `popstate` (atrás/adelante).
 * - Avanza sola hasta ~90 % y termina cuando cambian `usePathname()` /
 *   `useSearchParams()` (la navegación se confirmó).
 * - Sin librerías. Estilos en globals.css (`.nav-progress`).
 * Se monta una vez por layout: admin, plataforma y storefront.
 */

export interface NavigationProgressProps {
  /** Color de la barra (default ámbar del admin). En el storefront: `var(--primary)`. */
  color?: string;
}

/** Devuelve la URL destino si el click es una navegación interna a otra página. */
function internalHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target as Element | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.getAttribute("aria-disabled") === "true") return null;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // Misma página (o sólo cambia el hash): no hay navegación.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return url.pathname + url.search;
}

interface Run {
  /** Ruta en la que arrancó; cuando la ruta cambia, terminó. */
  from: string;
  value: number;
}

function Bar({ color }: NavigationProgressProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [run, setRun] = useState<Run | null>(null);
  const routeRef = useRef(routeKey);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    routeRef.current = routeKey;
  }, [routeKey]);

  // Clicks en links internos y atrás/adelante.
  useEffect(() => {
    const stopTimers = () => {
      if (trickle.current) clearInterval(trickle.current);
      if (safety.current) clearTimeout(safety.current);
    };
    const start = () => {
      stopTimers();
      setRun({ from: routeRef.current, value: 0.08 });
      trickle.current = setInterval(() => {
        // Rápido al principio y cada vez más lento; nunca pasa de 0.9.
        setRun((r) => (r && r.value < 0.9 ? { ...r, value: r.value + (0.9 - r.value) * 0.12 } : r));
      }, 180);
      // Navegación cancelada o fallida: no dejar la barra colgada.
      safety.current = setTimeout(() => {
        stopTimers();
        setRun(null);
      }, 12000);
    };
    const onClick = (e: MouseEvent) => {
      if (internalHref(e)) start();
    };
    const onPopState = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      stopTimers();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const finished = run !== null && run.from !== routeKey;

  // Terminó: completar, desvanecer y desmontar.
  useEffect(() => {
    if (!finished) return;
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    const t = setTimeout(() => setRun(null), 320);
    return () => clearTimeout(t);
  }, [finished]);

  if (!run) return null;
  const value = finished ? 1 : run.value;
  return (
    <div
      className="nav-progress"
      role="progressbar"
      aria-label="Cargando página"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      style={color ? ({ "--nav-progress-color": color } as CSSProperties) : undefined}
    >
      <span style={{ "--p": value, opacity: finished ? 0 : 1 } as CSSProperties} />
    </div>
  );
}

/** Montala una vez en el layout (admin, plataforma, storefront). */
export function NavigationProgress(props: NavigationProgressProps) {
  return (
    <Suspense fallback={null}>
      <Bar {...props} />
    </Suspense>
  );
}
