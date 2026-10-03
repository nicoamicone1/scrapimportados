import type { ModuleCode } from "@/lib/modules/registry";
import { cn } from "@/lib/cn";

/*
 * Ilustraciones de las apps (catálogo /admin/apps y estado vacío de cada app).
 * Línea plana sobre la tinta del sidebar, sin gradientes ni brillos
 * (DESIGN.md §1.2): lo único en pomelo es lo que la app "produce".
 */

/** Ancho de cada capa de la pieza, de abajo hacia arriba (un jarrón que se abre). */
const LAYERS = [48, 46, 43, 41, 40, 41, 44, 48, 52, 55, 57];
const LAYER_H = 5.5;
const BED_Y = 150;
const CENTER_X = 111;

function Print3dArt({ className }: { className?: string }) {
  const top = BED_Y - LAYERS.length * LAYER_H;
  const current = LAYERS[LAYERS.length - 1] + 2;
  return (
    <svg viewBox="0 0 260 190" fill="none" aria-hidden className={className}>
      {/* Gabinete */}
      <rect x="38" y="16" width="148" height="162" rx="6" className="stroke-adm-sidebar-muted" strokeWidth="1.5" />
      {/* Grilla de la cama (vista de frente: sólo las marcas) */}
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={54 + i * 14.5} y1={BED_Y + 10} x2={54 + i * 14.5} y2={BED_Y + 14} className="stroke-adm-sidebar-muted" strokeWidth="1" />
      ))}
      {/* Cama */}
      <rect x="50" y={BED_Y} width="122" height="6" rx="1" className="fill-adm-sidebar-muted" />
      {/* Pieza: capas ya impresas */}
      {LAYERS.slice(0, -1).map((w, i) => (
        <rect
          key={i}
          x={CENTER_X - w / 2}
          y={BED_Y - (i + 1) * LAYER_H}
          width={w}
          height={LAYER_H - 1}
          rx="1.5"
          className="fill-adm-accent-2"
          opacity={0.72 + (i / LAYERS.length) * 0.28}
        />
      ))}
      {/* Capa en curso: mitad hecha, mitad por hacer */}
      <rect x={CENTER_X - current / 2} y={top} width={current / 2} height={LAYER_H - 1} rx="1.5" className="fill-adm-accent-2" />
      <rect
        x={CENTER_X}
        y={top + 0.5}
        width={current / 2}
        height={LAYER_H - 2}
        rx="1.5"
        className="stroke-adm-sidebar-muted"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Eje X */}
      <line x1="46" y1="58" x2="178" y2="58" className="stroke-adm-sidebar-fg" strokeWidth="3" strokeLinecap="round" />
      {/* Cabezal + boquilla, justo sobre la capa en curso */}
      <rect x={CENTER_X - 13} y="48" width="26" height="24" rx="3" className="fill-adm-sidebar-active stroke-adm-sidebar-fg" strokeWidth="1.5" />
      <line x1={CENTER_X - 6} y1="56" x2={CENTER_X + 6} y2="56" className="stroke-adm-sidebar-muted" strokeWidth="1" />
      <line x1={CENTER_X - 6} y1="61" x2={CENTER_X + 6} y2="61" className="stroke-adm-sidebar-muted" strokeWidth="1" />
      <path d={`M${CENTER_X - 5} 72 H${CENTER_X + 5} L${CENTER_X} ${top - 2} Z`} className="fill-adm-accent-2" />
      {/* Bobina */}
      <circle cx="224" cy="56" r="24" className="stroke-adm-sidebar-fg" strokeWidth="1.5" />
      <circle cx="224" cy="56" r="17" className="stroke-adm-accent-2" strokeWidth="9" opacity="0.9" />
      <circle cx="224" cy="56" r="6" className="stroke-adm-sidebar-fg" strokeWidth="1.5" />
      <line x1="224" y1="80" x2="224" y2="178" className="stroke-adm-sidebar-muted" strokeWidth="1.5" />
      <line x1="210" y1="178" x2="238" y2="178" className="stroke-adm-sidebar-muted" strokeWidth="1.5" strokeLinecap="round" />
      {/* Filamento: de la bobina al cabezal */}
      <path d={`M204 68 C 188 100, 150 6, ${CENTER_X + 4} 48`} className="stroke-adm-accent-2" strokeWidth="1.5" />
    </svg>
  );
}

/** Ilustración de una app (siempre decorativa). */
export function AppArt({ code, className }: { code: ModuleCode; className?: string }) {
  switch (code) {
    case "print3d":
      return <Print3dArt className={cn("h-auto w-full", className)} />;
  }
}
