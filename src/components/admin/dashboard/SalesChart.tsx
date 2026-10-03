"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";

import { niceMax, type SeriesPoint } from "@/lib/admin/dashboard-utils";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber } from "@/lib/money";

import "./dashboard.css";

/**
 * Curva de ventas (BRAND §5, §9): línea pomelo con curva suave (monótona: no
 * inventa picos ni baja de cero), área lavada debajo, el período actual
 * marcado y un tooltip-burbuja tinta (aparece con un rebote corto) al pasar el
 * mouse o con las flechas del teclado. SVG propio, sin librerías. La curva no
 * se anima al entrar: en el panel nada demora la lectura (BRAND §9).
 * Accesible: el gráfico tiene su resumen en `aria-label`, una tabla oculta
 * con todos los valores y una región viva con el punto activo.
 */
export function SalesChart({
  points,
  currency,
  caption,
  emptyHint = "Cuando entren pedidos vas a ver la curva acá.",
}: {
  points: SeriesPoint[];
  currency: string;
  caption: string;
  emptyHint?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const empty = points.every((p) => p.sales === 0);
  const point = active === null ? null : points[active];
  const live = point ? `${point.title}: ${formatMoney(point.sales, { currency })}, ${formatNumber(point.orders)} ${point.orders === 1 ? "pedido" : "pedidos"}` : "";

  const shared = { points, currency, caption, active, setActive, empty };
  return (
    <figure className="relative m-0">
      {/* Dos dibujos del mismo dato: el SVG escala con el ancho, así que en un
          celular el de 720 dejaría el texto en 5 px. El que no corresponde
          queda en display:none. */}
      <CurveSvg {...shared} width={360} height={210} left={44} labelEvery={(n) => (n > 24 ? 7 : n > 12 ? 4 : n > 7 ? 2 : 1)} className="block sm:hidden" />
      <CurveSvg {...shared} width={720} height={236} left={60} labelEvery={(n) => (n > 24 ? 5 : n > 12 ? 3 : 1)} className="hidden sm:block" />
      {empty ? (
        <div className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center px-4">
          <div className="eco-bubble max-w-xs border border-adm-border bg-adm-surface px-4 py-2.5 text-center shadow-adm-card [--eco-bubble-r:18px]">
            <p className="text-[13px] font-semibold text-adm-fg">Sin ventas en el período</p>
            <p className="text-xs text-adm-fg-muted">{emptyHint}</p>
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {live}
      </p>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Período</th>
            <th>Ventas</th>
            <th>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>{p.title}</td>
              <td>{formatMoney(p.sales, { currency })}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const one = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
/** "$ 27 mil", "$ 1,5 M" (el compacto de Intl en es-AR usa "k"). */
const compact = (v: number) => (v >= 1e6 ? `${one.format(v / 1e6)} M` : v >= 1e3 ? `${one.format(v / 1e3)} mil` : one.format(v));

/** Curva monótona (Fritsch–Carlson) como path SVG: suave y sin sobrepasar los datos. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (!n) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M${r(xs[0])},${r(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${r(xs[i] + h)},${r(ys[i] + t[i] * h)} ${r(xs[i + 1] - h)},${r(ys[i + 1] - t[i + 1] * h)} ${r(xs[i + 1])},${r(ys[i + 1])}`;
  }
  return d;
}

function CurveSvg({
  points,
  currency,
  caption,
  active,
  setActive,
  empty,
  width: W,
  height: H,
  left,
  labelEvery,
  className,
}: {
  points: SeriesPoint[];
  currency: string;
  caption: string;
  active: number | null;
  setActive: (i: number | null) => void;
  empty: boolean;
  width: number;
  height: number;
  left: number;
  labelEvery: (n: number) => number;
  className?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const right = 14;
  const top = 18;
  const bottom = 28;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const base = top + plotH;
  const max = niceMax(Math.max(0, ...points.map((p) => p.sales)));
  const n = points.length;
  const xs = points.map((_, i) => (n > 1 ? left + (plotW * i) / (n - 1) : left + plotW / 2));
  const ys = points.map((p) => base - (max ? (p.sales / max) * plotH : 0));
  const line = monotonePath(xs, ys);
  const area = n > 1 ? `${line}L${xs[n - 1]},${base}L${xs[0]},${base}Z` : "";
  const every = labelEvery(n);
  const current = points.findIndex((p) => p.current);
  const showLabel = (i: number) => i === current || (i % every === 0 && (current < 0 || Math.abs(i - current) >= 2));

  const indexAt = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round(((vx - left) / plotW) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const from = active ?? (current >= 0 ? current : n - 1);
    const to = e.key === "ArrowLeft" ? from - 1 : e.key === "ArrowRight" ? from + 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (to === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(n - 1, to)));
  };

  const a = active !== null && !empty ? active : null;
  const p = a !== null ? points[a] : null;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y overflow-visible rounded-adm outline-none"
        role="img"
        aria-label={`${caption} Usá las flechas para recorrer los valores.`}
        tabIndex={empty ? -1 : 0}
        onPointerMove={empty ? undefined : (e) => setActive(indexAt(e))}
        onPointerDown={empty ? undefined : (e) => setActive(indexAt(e))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => (empty ? null : setActive(current >= 0 ? current : n - 1))}
        onBlur={() => setActive(null)}
        onKeyDown={empty ? undefined : onKey}
      >
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--eco-pomelo)" stopOpacity={0.26} />
            <stop offset="100%" stopColor="var(--eco-durazno)" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        {[1 / 3, 2 / 3, 1].map((f) => {
          const y = base - plotH * f;
          return (
            <g key={f}>
              <line x1={left} x2={W - right} y1={y} y2={y} className="stroke-adm-border" strokeWidth={1} strokeDasharray="3 5" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="fill-adm-fg-muted text-[11px] tabular-nums">
                $ {compact(max * f)}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={W - right} y1={base} y2={base} className="stroke-adm-border" strokeWidth={1} />

        {/* Hoy: banda suave detrás de la columna actual. */}
        {current >= 0 && n > 1 && !empty
          ? (() => {
              const half = plotW / (n - 1) / 2;
              const x0 = Math.max(left, xs[current] - half);
              const x1 = Math.min(W - right, xs[current] + half);
              return <rect x={x0} y={top} width={x1 - x0} height={plotH} className="fill-eco-pomelo-soft" opacity={0.7} rx={6} />;
            })()
          : null}

        {empty ? (
          <path d={`M${left},${base - 1}H${W - right}`} className="stroke-eco-line" strokeWidth={2.5} strokeLinecap="round" />
        ) : (
          <>
            {area ? <path d={area} fill={`url(#area-${gid})`} /> : null}
            <path d={line} fill="none" className="stroke-eco-pomelo" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Punto de hoy: siempre visible. */}
        {current >= 0 && !empty ? (
          <circle cx={xs[current]} cy={ys[current]} r={5} className="fill-eco-pomelo stroke-adm-surface" strokeWidth={2.5} />
        ) : null}

        {/* Punto activo (mouse / teclado). */}
        {a !== null ? (
          <g className="pointer-events-none">
            <line x1={xs[a]} x2={xs[a]} y1={top} y2={base} className="stroke-adm-fg" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={xs[a]} cy={ys[a]} r={5.5} className="fill-adm-fg stroke-adm-surface" strokeWidth={2.5} />
          </g>
        ) : null}

        {points.map((pt, i) =>
          showLabel(i) ? (
            <text
              key={pt.key}
              x={xs[i]}
              y={H - 8}
              textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"}
              className={pt.current ? "fill-eco-pomelo-ink text-[11px] font-semibold" : a === i ? "fill-adm-fg text-[11px] font-medium" : "fill-adm-fg-muted text-[11px]"}
            >
              {pt.current ? `${pt.label} · hoy` : pt.label}
            </text>
          ) : null,
        )}
      </svg>

      {p && a !== null ? (
        <div
          aria-hidden
          className="dsh-tip eco-bubble pointer-events-none absolute z-10 min-w-32 bg-adm-fg px-3 py-2 text-white shadow-adm [--eco-bubble-r:14px]"
          style={{
            left: `${Math.min(88, Math.max(12, (xs[a] / W) * 100))}%`,
            top: `${(ys[a] / H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <p className="text-[11px] whitespace-nowrap text-eco-mist/80">{p.title}</p>
          <p className="eco-num text-[15px] leading-5 whitespace-nowrap">{formatMoney(p.sales, { currency })}</p>
          <p className="text-[11px] whitespace-nowrap text-eco-mist/80">
            {formatNumber(p.orders)} {p.orders === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
