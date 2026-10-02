import { cn } from "@/lib/cn";

/** Volumen de referencia (mm): todas las camas se dibujan a la misma escala. */
const REF = 320;
const COS = Math.cos(Math.PI / 6);
const GRID_MM = 50;

type P3 = [number, number, number];

/**
 * Volumen de impresión en isométrica, a escala real respecto de un cubo de
 * 320 mm: una A1 mini se ve chica al lado de una K1 Max. El plato lleva la
 * tinta de la impresora y una grilla cada 5 cm.
 */
export function BedDiagram({
  bed,
  color,
  className,
  title,
}: {
  bed: [number, number, number];
  color: string;
  className?: string;
  title?: string;
}) {
  const safe = bed.map((v) => (Number.isFinite(v) && v > 0 ? v : 1)) as P3;
  // Camas más grandes que la referencia se achican para entrar (pierden la escala común).
  const k = Math.min(1, REF / Math.max(...safe));
  const [bx, by, bz] = safe.map((v) => v * k) as P3;
  const proj = ([x, y, z]: P3): [number, number] => {
    const dx = x - bx / 2;
    const dy = y - by / 2;
    return [(dx - dy) * COS, (dx + dy) * 0.5 - z];
  };
  const pts = (list: P3[]) => list.map((p) => proj(p).join(",")).join(" ");

  const plate: P3[] = [
    [0, 0, 0],
    [bx, 0, 0],
    [bx, by, 0],
    [0, by, 0],
  ];
  const top: P3[] = plate.map(([x, y]) => [x, y, bz]);

  const grid: [P3, P3][] = [];
  for (let x = GRID_MM; x < bx; x += GRID_MM) grid.push([[x, 0, 0], [x, by, 0]]);
  for (let y = GRID_MM; y < by; y += GRID_MM) grid.push([[0, y, 0], [bx, y, 0]]);

  // Aristas verticales: la de atrás (0,0) queda oculta detrás del volumen.
  const verticals: { from: P3; to: P3; hidden: boolean }[] = plate.map(([x, y]) => ({
    from: [x, y, 0],
    to: [x, y, bz],
    hidden: x === 0 && y === 0,
  }));

  const vb = [-REF * COS - 8, -REF * 1.5 - 8, REF * COS * 2 + 16, REF * 2 + 16].join(" ");

  return (
    <svg viewBox={vb} className={cn("block", className)} role="img" aria-label={title ?? `Cama de ${bed.join(" × ")} mm`}>
      <polygon points={pts(plate)} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {grid.map(([a, b], i) => {
        const [x1, y1] = proj(a);
        const [x2, y2] = proj(b);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {verticals.map((v, i) => {
        const [x1, y1] = proj(v.from);
        const [x2, y2] = proj(v.to);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--adm-fg-muted)"
            strokeOpacity={v.hidden ? 0.25 : 0.55}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <polygon
        points={pts(top)}
        fill="none"
        stroke="var(--adm-fg-muted)"
        strokeOpacity={0.55}
        strokeWidth={1}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
