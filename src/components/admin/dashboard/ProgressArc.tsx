import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import "./dashboard.css";

/*
 * Progreso en arco: el trazo de la panza de la "e" del logo (BRAND §4.1,
 * §7.2). Abre abajo a la derecha, como el glifo, con extremos rectos. El
 * valor crece una vez al montar (720 ms); el número del centro no cuenta.
 */

const OPEN = 50; // grados de la apertura (abajo a la derecha)

function arcPath(size: number, stroke: number) {
  const c = size / 2;
  const r = c - stroke / 2;
  const a = (OPEN * Math.PI) / 180;
  const end = { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  // Desde la punta de la barra (0°) en sentido antihorario hasta la apertura.
  return `M ${c + r} ${c} A ${r} ${r} 0 1 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function ProgressArc({
  value,
  max,
  size = 72,
  stroke,
  tone = "pomelo",
  label,
  children,
  className,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** pomelo (marca, progreso) · ink (uso de plan) · warning (cerca del límite). */
  tone?: "pomelo" | "ink" | "warning" | "danger";
  /** Texto para lectores de pantalla ("3 de 6 pasos listos"). */
  label: string;
  /** Contenido del centro (por defecto, "valor/máx"). */
  children?: ReactNode;
  className?: string;
}) {
  const sw = stroke ?? Math.max(5, Math.round(size / 9));
  const d = arcPath(size, sw);
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color =
    tone === "ink" ? "stroke-adm-fg" : tone === "warning" ? "stroke-adm-warning" : tone === "danger" ? "stroke-adm-danger" : "stroke-eco-pomelo";
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden className="absolute inset-0">
        <path d={d} fill="none" className={tone === "pomelo" ? "stroke-eco-durazno" : "stroke-eco-line"} strokeWidth={sw} />
        {pct > 0 ? (
          <path d={d} fill="none" pathLength={100} strokeDasharray={`${pct} 100`} className={cn("dsh-arc", color)} strokeWidth={sw} />
        ) : null}
      </svg>
      <span aria-hidden className="relative">
        {children ?? (
          <span className="eco-num text-[15px] leading-none text-adm-fg">
            {value}
            <span className="text-adm-fg-muted">/{max}</span>
          </span>
        )}
      </span>
    </div>
  );
}
