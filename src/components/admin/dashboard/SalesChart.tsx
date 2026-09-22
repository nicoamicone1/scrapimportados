import { niceMax, type SeriesPoint } from "@/lib/admin/dashboard-utils";
import { formatMoney, formatNumber } from "@/lib/money";

/**
 * Barras verticales monocromas (DESIGN.md §7.8): `--adm-fg` al 80 %, el
 * período actual en `--adm-accent`, 3 líneas guía, sin gradientes ni
 * animación. SVG propio; tooltip nativo con el monto exacto y una tabla
 * oculta para lectores de pantalla.
 */
export function SalesChart({ points, currency, caption }: { points: SeriesPoint[]; currency: string; caption: string }) {
  const W = 720;
  const H = 208;
  const left = 64;
  const right = 8;
  const top = 10;
  const bottom = 26;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const max = niceMax(Math.max(0, ...points.map((p) => p.sales)));
  const n = Math.max(1, points.length);
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(28, slot * 0.68));
  const every = n > 24 ? 5 : n > 12 ? 3 : 1;
  const one = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
  // "$ 27 mil", "$ 1,5 M" (el compacto de Intl en es-AR usa "k").
  const compact = {
    format: (v: number) => (v >= 1e6 ? `${one.format(v / 1e6)} M` : v >= 1e3 ? `${one.format(v / 1e3)} mil` : one.format(v)),
  };
  const empty = points.every((p) => p.sales === 0);
  const currentIndex = points.findIndex((p) => p.current);
  // Etiqueta cada `every` barras y siempre la actual, sin pisar a las vecinas.
  const showLabel = (i: number) =>
    i === currentIndex || (i % every === 0 && (currentIndex < 0 || Math.abs(i - currentIndex) >= Math.min(every, 2)));

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={caption}>
        {[1 / 3, 2 / 3, 1].map((f) => {
          const y = top + plotH - plotH * f;
          return (
            <g key={f}>
              <line x1={left} x2={W - right} y1={y} y2={y} className="stroke-adm-border" strokeWidth={1} />
              <text x={left - 8} y={y + 4} textAnchor="end" className="fill-adm-fg-muted text-[11px]">
                $ {compact.format(max * f)}
              </text>
            </g>
          );
        })}
        <line x1={left} x2={W - right} y1={top + plotH} y2={top + plotH} className="stroke-adm-border" strokeWidth={1} />
        {points.map((p, i) => {
          const h = max ? (p.sales / max) * plotH : 0;
          const x = left + slot * i + (slot - barW) / 2;
          const y = top + plotH - h;
          return (
            <g key={p.key}>
              <rect
                x={left + slot * i}
                y={top}
                width={slot}
                height={plotH}
                className="fill-transparent"
              >
                <title>{`${p.title}: ${formatMoney(p.sales, { currency })} · ${formatNumber(p.orders)} ${p.orders === 1 ? "pedido" : "pedidos"}`}</title>
              </rect>
              {h > 0 ? (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, h)}
                  rx={1.5}
                  className={p.current ? "pointer-events-none fill-adm-accent" : "pointer-events-none fill-adm-fg/80"}
                />
              ) : null}
              {showLabel(i) ? (
                <text
                  x={left + slot * i + slot / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className={p.current ? "fill-adm-fg text-[11px] font-medium" : "fill-adm-fg-muted text-[11px]"}
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {empty ? (
          <text x={left + plotW / 2} y={top + plotH / 2} textAnchor="middle" className="fill-adm-fg-muted text-[13px]">
            Sin ventas en el período
          </text>
        ) : null}
      </svg>
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
