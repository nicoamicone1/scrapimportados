import { cn } from "@/lib/cn";

/**
 * Miniatura estática de una pieza: la caja contenedora en isométrica, pintada
 * con el color del filamento (sin WebGL). Sirve de miniatura en la lista de
 * piezas antes de que el visor saque su foto y en la página de la cotización,
 * donde el archivo no se expone.
 */
export function BoxSketch({
  bbox,
  hex,
  className,
  title,
}: {
  bbox: readonly [number, number, number] | null;
  hex: string;
  className?: string;
  title?: string;
}) {
  const [x, y, z] = bbox && bbox.every((v) => v > 0) ? bbox : [1, 1, 1];
  // Proporciones reales, pero ninguna cara menor al 12 % de la mayor (una lámina igual se ve).
  const max = Math.max(x, y, z);
  const nx = Math.max(x / max, 0.12);
  const ny = Math.max(y / max, 0.12);
  const nz = Math.max(z / max, 0.12);
  const c = Math.cos(Math.PI / 6);
  const s = 0.5;
  const p = (px: number, py: number, pz: number) => [(px - py) * c, (px + py) * s - pz] as const;
  const pts = {
    o: p(0, 0, 0),
    x: p(nx, 0, 0),
    y: p(0, ny, 0),
    xy: p(nx, ny, 0),
    z: p(0, 0, nz),
    xz: p(nx, 0, nz),
    yz: p(0, ny, nz),
    xyz: p(nx, ny, nz),
  };
  const all = Object.values(pts);
  const minU = Math.min(...all.map((q) => q[0]));
  const maxU = Math.max(...all.map((q) => q[0]));
  const minV = Math.min(...all.map((q) => q[1]));
  const maxV = Math.max(...all.map((q) => q[1]));
  const w = maxU - minU;
  const h = maxV - minV;
  const pad = Math.max(w, h) * 0.14;
  const vb = `${minU - pad} ${minV - pad} ${w + pad * 2} ${h + pad * 2}`;
  const poly = (...qs: (readonly [number, number])[]) => qs.map((q) => `${q[0].toFixed(3)},${q[1].toFixed(3)}`).join(" ");
  const stroke = Math.max(w, h) * 0.012;

  return (
    <svg viewBox={vb} className={cn("block", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {/* Sombra en la cama */}
      <polygon points={poly(pts.o, pts.x, pts.xy, pts.y)} fill="currentColor" opacity={0.12} />
      {/* Cara izquierda (y máx.) */}
      <polygon points={poly(pts.y, pts.xy, pts.xyz, pts.yz)} fill={hex} />
      <polygon points={poly(pts.y, pts.xy, pts.xyz, pts.yz)} fill="#000" opacity={0.12} />
      {/* Cara derecha (x máx.) */}
      <polygon points={poly(pts.x, pts.xy, pts.xyz, pts.xz)} fill={hex} />
      <polygon points={poly(pts.x, pts.xy, pts.xyz, pts.xz)} fill="#000" opacity={0.3} />
      {/* Techo */}
      <polygon points={poly(pts.z, pts.xz, pts.xyz, pts.yz)} fill={hex} />
      <polygon points={poly(pts.z, pts.xz, pts.xyz, pts.yz)} fill="#fff" opacity={0.12} />
      <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" opacity={0.55}>
        <polygon points={poly(pts.y, pts.xy, pts.xyz, pts.yz)} />
        <polygon points={poly(pts.x, pts.xy, pts.xyz, pts.xz)} />
        <polygon points={poly(pts.z, pts.xz, pts.xyz, pts.yz)} />
      </g>
    </svg>
  );
}
