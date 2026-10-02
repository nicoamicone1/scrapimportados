import { StoreButtonLink } from "./Button";
import type { BlockProps } from "./types";

/**
 * Llamado al cotizador 3D (app Taller 3D): texto a la izquierda y, a la
 * derecha, el dibujo técnico de una pieza a medio imprimir sobre la cama
 * (capas, boquilla y grilla) en los colores del tema. Si la app se apagó,
 * `isBlockEmpty` lo oculta (no llega acá).
 */
export function Print3dCta({ block, ctx }: BlockProps<"print3d_cta">) {
  const s = block.settings;
  return (
    <div className="grid items-center gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
      <div className="min-w-0">
        {s.eyebrow ? <p className="eyebrow mb-2">{s.eyebrow}</p> : null}
        <h2 className="blk-title">{s.title}</h2>
        {s.text ? <p className="mt-3 max-w-[56ch] text-fg-muted">{s.text}</p> : null}
        <p className="tnum mt-4 text-xs tracking-[0.08em] text-fg-muted uppercase">STL · 3MF · precio y fecha al instante</p>
        {s.cta.label ? (
          <div className="mt-6">
            <StoreButtonLink theme={ctx.theme} href={s.cta.href || "/impresion-3d"} variant="solid">
              {s.cta.label}
            </StoreButtonLink>
          </div>
        ) : null}
      </div>
      <PrintSketch />
    </div>
  );
}

/** Pieza a medio imprimir: cama en isométrica con grilla, capas apiladas y el hotend arriba. */
function PrintSketch() {
  // Isométrica simple: (x, y, z) → (u, v).
  const c = 0.866;
  const p = (x: number, y: number, z: number) => `${(160 + (x - y) * c).toFixed(1)},${(150 + (x + y) * 0.5 - z).toFixed(1)}`;
  const bed = 110;
  const grid: string[] = [];
  for (let i = -bed; i <= bed; i += 22) {
    grid.push(`M${p(i, -bed, 0)}L${p(i, bed, 0)}`, `M${p(-bed, i, 0)}L${p(bed, i, 0)}`);
  }
  // Capas de un cilindro escalonado (como un vaso a medio imprimir).
  const layers = Array.from({ length: 9 }, (_, i) => i);
  const r = 34;
  const h = 7;
  const ellipse = (z: number, rr: number) => {
    const [cx, cy] = p(0, 0, z).split(",").map(Number);
    return { cx, cy, rx: rr * c * 1.414, ry: rr * 0.5 * 1.414 };
  };
  const top = ellipse(layers.length * h, r);
  return (
    <svg viewBox="0 0 320 250" className="mx-auto block w-full max-w-[340px] text-fg-muted" aria-hidden>
      <path d={`M${p(-bed, -bed, 0)}L${p(bed, -bed, 0)}L${p(bed, bed, 0)}L${p(-bed, bed, 0)}Z`} fill="currentColor" opacity={0.06} />
      <path d={grid.join("")} stroke="currentColor" strokeWidth={0.6} opacity={0.35} fill="none" />
      <path d={`M${p(-bed, -bed, 0)}L${p(bed, -bed, 0)}L${p(bed, bed, 0)}L${p(-bed, bed, 0)}Z`} stroke="currentColor" strokeWidth={1.2} fill="none" opacity={0.7} />
      {/* Cuerpo de la pieza */}
      {layers.map((i) => {
        const e = ellipse(i * h, r);
        return <ellipse key={i} cx={e.cx} cy={e.cy - h / 2} rx={e.rx} ry={e.ry} fill="var(--primary)" />;
      })}
      <rect x={top.cx - top.rx} y={top.cy} width={top.rx * 2} height={layers.length * h} fill="var(--primary)" />
      {layers.map((i) => {
        const e = ellipse(i * h, r);
        return (
          <path
            key={`l${i}`}
            d={`M${e.cx - e.rx},${e.cy} A${e.rx},${e.ry} 0 0 0 ${e.cx + e.rx},${e.cy}`}
            stroke="var(--primary-fg)"
            strokeWidth={0.8}
            opacity={0.35}
            fill="none"
          />
        );
      })}
      <ellipse cx={top.cx} cy={top.cy} rx={top.rx} ry={top.ry} fill="var(--primary)" />
      <ellipse cx={top.cx} cy={top.cy} rx={top.rx} ry={top.ry} fill="var(--primary-fg)" opacity={0.18} />
      {/* Hotend: bloque y boquilla sobre el borde de la capa actual */}
      <g transform={`translate(${top.cx + top.rx * 0.55} ${top.cy - top.ry * 0.6})`} className="text-fg">
        <path d="M0,0 L-5,-9 L5,-9 Z" fill="currentColor" />
        <rect x={-15} y={-31} width={30} height={22} rx={2} fill="currentColor" />
        <rect x={-4} y={-58} width={8} height={27} fill="currentColor" opacity={0.6} />
      </g>
    </svg>
  );
}
