"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Selector visual para los campos de disposición del tema (`theme.style.*`,
 * header, footer): cada opción es una miniatura esquemática + nombre, en un
 * radiogroup con flechas. Panel (BRAND §10): seleccionado en tinta con texto
 * blanco, foco azul; los dibujos son `currentColor`.
 */

export interface VisualOption<T extends string> {
  value: T;
  label: string;
  /** Una línea: qué hace y para qué rubro sirve (tooltip y lector de pantalla). */
  hint?: string;
  picto: ReactNode;
}

export function VisualChoice<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  columns = 3,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: VisualOption<T>[];
  hint?: ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[13px] font-medium text-adm-fg">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className={cn("grid gap-1.5", columns === 2 ? "grid-cols-2" : columns === 4 ? "grid-cols-4" : "grid-cols-3")}
      >
        {options.map((o, i) => {
          const active = i === index;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.hint ? `${o.label}: ${o.hint}` : undefined}
              title={o.hint}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "group flex min-h-11 flex-col items-center gap-1 rounded-adm border p-1.5 text-center text-xs transition-[background-color,border-color,color] duration-150",
                active
                  ? "border-adm-fg bg-adm-fg text-adm-surface"
                  : "border-adm-border bg-adm-surface text-adm-fg-muted hover:border-adm-input-border hover:text-adm-fg",
              )}
            >
              <svg viewBox="0 0 64 40" className="h-9 w-full" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.5}>
                {o.picto}
              </svg>
              <span className={cn("leading-tight", active && "font-medium")}>{o.label}</span>
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-xs text-adm-fg-muted">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------- Pictogramas */
// Convención: contorno de la página a 0.35 de opacidad, bloques llenos a 0.25,
// lo protagonista a opacidad completa. Todo en una caja de 64 × 40.

const page = <rect x="1" y="1" width="62" height="38" rx="3" opacity={0.35} />;
const fill = (x: number, y: number, w: number, h: number, o = 0.25, r = 1) => (
  <rect x={x} y={y} width={w} height={h} rx={r} fill="currentColor" stroke="none" opacity={o} />
);
const line = (x1: number, y1: number, x2: number, y2: number, o = 1) => <line x1={x1} y1={y1} x2={x2} y2={y2} opacity={o} />;

export const PICTOS = {
  header: {
    "logo-left": (
      <>
        {page}
        {fill(6, 7, 12, 4, 1)}
        {fill(22, 8, 6, 2, 0.5)}
        {fill(30, 8, 6, 2, 0.5)}
        <rect x="40" y="6" width="14" height="6" rx="1" />
        {fill(57, 7, 3, 4, 0.8)}
        {line(1, 16, 63, 16, 0.35)}
      </>
    ),
    "logo-center": (
      <>
        {page}
        {fill(6, 8, 5, 2, 0.5)}
        {fill(13, 8, 5, 2, 0.5)}
        {fill(25, 6, 14, 6, 1)}
        {fill(50, 7, 3, 4, 0.8)}
        {fill(56, 7, 3, 4, 0.8)}
        {line(1, 16, 63, 16, 0.35)}
      </>
    ),
    minimal: (
      <>
        {page}
        {fill(6, 7, 10, 4, 1)}
        {fill(36, 8, 7, 2, 0.6)}
        {fill(45, 8, 6, 2, 0.6)}
        {fill(53, 8, 6, 2, 0.6)}
        {line(1, 16, 63, 16, 0.35)}
      </>
    ),
    stacked: (
      <>
        {page}
        {fill(20, 5, 24, 8, 1)}
        {line(1, 16, 63, 16, 0.35)}
        {fill(16, 19, 6, 2, 0.6)}
        {fill(25, 19, 6, 2, 0.6)}
        {fill(34, 19, 6, 2, 0.6)}
        {fill(43, 19, 6, 2, 0.6)}
        {line(1, 24, 63, 24, 0.35)}
      </>
    ),
    pill: (
      <>
        {page}
        <rect x="6" y="5" width="52" height="10" rx="5" />
        {fill(10, 8.5, 9, 3, 1)}
        {fill(26, 9, 5, 2, 0.5)}
        {fill(33, 9, 5, 2, 0.5)}
        {fill(51, 8.5, 3, 3, 0.8)}
      </>
    ),
    double: (
      <>
        {page}
        {fill(5, 6, 9, 4, 1)}
        <rect x="18" y="5" width="32" height="6" rx="1" strokeWidth={2} />
        {fill(54, 6, 5, 4, 0.8)}
        {fill(1, 14, 62, 6, 0.9, 0)}
      </>
    ),
  },
  card: {
    stack: (
      <>
        {fill(10, 3, 18, 22, 0.25)}
        {fill(10, 28, 14, 2, 0.7)}
        {fill(10, 33, 9, 3, 1)}
        {fill(36, 3, 18, 22, 0.25)}
        {fill(36, 28, 14, 2, 0.7)}
        {fill(36, 33, 9, 3, 1)}
      </>
    ),
    overlay: (
      <>
        {fill(8, 3, 22, 34, 0.25)}
        {fill(8, 25, 22, 12, 0.7, 0)}
        {fill(34, 3, 22, 34, 0.25)}
        {fill(34, 25, 22, 12, 0.7, 0)}
      </>
    ),
    boxed: (
      <>
        <rect x="7" y="2" width="23" height="36" rx="2" />
        {fill(10, 5, 17, 15, 0.25)}
        {fill(10, 23, 13, 2, 0.6)}
        {fill(10, 31, 17, 4, 1)}
        <rect x="34" y="2" width="23" height="36" rx="2" />
        {fill(37, 5, 17, 15, 0.25)}
        {fill(37, 23, 13, 2, 0.6)}
        {fill(37, 31, 17, 4, 1)}
      </>
    ),
    row: (
      <>
        {[4, 15, 26].map((y) => (
          <g key={y}>
            {fill(6, y, 8, 8, 0.3)}
            {fill(17, y + 2, 20, 2, 0.6)}
            {fill(42, y + 2, 8, 3, 1)}
            {fill(52, y + 1, 7, 5, 0.9)}
            {line(6, y + 10, 59, y + 10, 0.3)}
          </g>
        ))}
      </>
    ),
    tile: (
      <>
        {fill(7, 2, 23, 36, 0.12, 4)}
        {fill(9, 4, 19, 19, 0.3, 3)}
        <circle cx="25" cy="20" r="3.5" fill="currentColor" stroke="none" />
        {fill(10, 27, 14, 2, 0.6)}
        {fill(10, 32, 9, 3, 1)}
        {fill(34, 2, 23, 36, 0.12, 4)}
        {fill(36, 4, 19, 19, 0.3, 3)}
        <circle cx="52" cy="20" r="3.5" fill="currentColor" stroke="none" />
        {fill(37, 27, 14, 2, 0.6)}
        {fill(37, 32, 9, 3, 1)}
      </>
    ),
  },
  grid: {
    uniform: (
      <>
        {[0, 1, 2, 3].map((c) => [0, 1].map((r) => <g key={`${c}${r}`}>{fill(5 + c * 14, 4 + r * 17, 12, 14, 0.35)}</g>))}
      </>
    ),
    feature: (
      <>
        {fill(5, 4, 26, 31, 0.6)}
        {fill(33, 4, 12, 14, 0.35)}
        {fill(47, 4, 12, 14, 0.35)}
        {fill(33, 21, 12, 14, 0.35)}
        {fill(47, 21, 12, 14, 0.35)}
      </>
    ),
    list: (
      <>
        {[5, 14, 23, 32].map((y) => (
          <g key={y}>
            {fill(6, y, 6, 6, 0.35)}
            {fill(15, y + 2, 26, 2, 0.6)}
            {fill(48, y + 1, 10, 4, 1)}
          </g>
        ))}
      </>
    ),
  },
  filters: {
    sidebar: (
      <>
        {page}
        {[6, 11, 16, 21, 26].map((y) => (
          <g key={y}>{fill(5, y, 12, 2, 0.6)}</g>
        ))}
        {line(20, 4, 20, 36, 0.35)}
        {[0, 1, 2].map((c) => [0, 1].map((r) => <g key={`${c}${r}`}>{fill(24 + c * 13, 5 + r * 16, 11, 13, 0.3)}</g>))}
      </>
    ),
    bar: (
      <>
        {page}
        <rect x="5" y="5" width="10" height="5" rx="2.5" fill="currentColor" />
        <rect x="17" y="5" width="12" height="5" rx="2.5" />
        <rect x="31" y="5" width="9" height="5" rx="2.5" />
        <rect x="42" y="5" width="11" height="5" rx="2.5" />
        {[0, 1, 2, 3].map((c) => <g key={c}>{fill(5 + c * 14, 15, 12, 20, 0.3)}</g>)}
      </>
    ),
    drawer: (
      <>
        {page}
        <rect x="5" y="5" width="13" height="5" rx="1" />
        {[0, 1, 2, 3].map((c) => <g key={c}>{fill(5 + c * 14, 15, 12, 20, 0.3)}</g>)}
        {fill(44, 1, 19, 38, 0.85, 0)}
      </>
    ),
  },
  gallery: {
    thumbs: (
      <>
        {[4, 11, 18].map((y) => (
          <g key={y}>{fill(5, y, 5, 5, 0.4)}</g>
        ))}
        {fill(13, 4, 22, 30, 0.6)}
        {fill(41, 6, 16, 3, 1)}
        {fill(41, 12, 10, 3, 0.6)}
        {fill(41, 28, 16, 5, 0.9)}
      </>
    ),
    grid: (
      <>
        {fill(5, 4, 15, 15, 0.5)}
        {fill(22, 4, 15, 15, 0.5)}
        {fill(5, 21, 15, 15, 0.5)}
        {fill(22, 21, 15, 15, 0.5)}
        {fill(43, 6, 15, 3, 1)}
        {fill(43, 28, 15, 5, 0.9)}
      </>
    ),
    stack: (
      <>
        {fill(6, 3, 30, 20, 0.6)}
        {fill(6, 25, 30, 14, 0.4)}
        {fill(42, 6, 16, 3, 1)}
        {fill(42, 12, 10, 3, 0.6)}
        {fill(42, 28, 16, 5, 0.9)}
      </>
    ),
    carousel: (
      <>
        {fill(0, 4, 40, 20, 0.6, 0)}
        {fill(42, 4, 22, 20, 0.3, 0)}
        {fill(6, 28, 16, 3, 1)}
        {fill(6, 33, 12, 4, 0.9)}
        {fill(34, 28, 22, 2, 0.4)}
        {fill(34, 33, 18, 2, 0.4)}
      </>
    ),
  },
  footer: {
    simple: (
      <>
        {page}
        {line(1, 22, 63, 22, 0.35)}
        {fill(5, 26, 22, 5, 1)}
        {fill(40, 28, 6, 2, 0.5)}
        {fill(48, 28, 6, 2, 0.5)}
        {fill(5, 34, 30, 2, 0.4)}
      </>
    ),
    columns: (
      <>
        {page}
        {line(1, 20, 63, 20, 0.35)}
        {fill(5, 24, 14, 3, 1)}
        {fill(5, 29, 18, 2, 0.4)}
        {[30, 41, 52].map((x) => (
          <g key={x}>
            {fill(x, 24, 7, 2, 0.8)}
            {fill(x, 28, 8, 1.5, 0.4)}
            {fill(x, 31, 6, 1.5, 0.4)}
          </g>
        ))}
      </>
    ),
    minimal: (
      <>
        {page}
        {line(1, 30, 63, 30, 0.35)}
        {fill(5, 33, 9, 2, 1)}
        {fill(17, 33, 7, 2, 0.4)}
        {fill(26, 33, 7, 2, 0.4)}
      </>
    ),
    statement: (
      <>
        {page}
        {line(1, 15, 63, 15, 0.35)}
        {fill(5, 18, 18, 2, 0.4)}
        <text x="32" y="35" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor" stroke="none">
          Tienda
        </text>
      </>
    ),
    band: (
      <>
        {page}
        <path d="M1 39 V22 Q1 16 9 16 H55 Q63 16 63 22 V39 Z" fill="currentColor" stroke="none" opacity={0.85} />
      </>
    ),
  },
  titles: {
    plain: <>{fill(5, 14, 30, 6, 1)}{fill(5, 25, 54, 10, 0.25)}</>,
    rule: (
      <>
        {fill(5, 14, 22, 6, 1)}
        {line(30, 19, 59, 19)}
        {fill(5, 25, 54, 10, 0.25)}
      </>
    ),
    centered: (
      <>
        {fill(27, 7, 10, 2, 0.5)}
        {fill(17, 12, 30, 6, 1)}
        {fill(5, 25, 54, 10, 0.25)}
      </>
    ),
    index: (
      <>
        <text x="5" y="20" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">
          01
        </text>
        {fill(18, 13, 28, 7, 1)}
        {fill(5, 25, 54, 10, 0.25)}
      </>
    ),
    tag: (
      <>
        <rect x="5" y="5" width="14" height="5" rx="2.5" fill="currentColor" />
        {fill(5, 13, 30, 6, 1)}
        {fill(5, 25, 54, 10, 0.25)}
      </>
    ),
  },
  shape: {
    rect: <rect x="18" y="4" width="28" height="32" fill="currentColor" stroke="none" opacity={0.6} />,
    soft: <rect x="18" y="4" width="28" height="32" rx="7" fill="currentColor" stroke="none" opacity={0.6} />,
    arch: <path d="M18 36 V18 A14 14 0 0 1 46 18 V36 Z" fill="currentColor" stroke="none" opacity={0.6} />,
    bubble: <path d="M18 36 V12 Q18 4 26 4 H38 Q46 4 46 12 V28 Q46 36 38 36 Z" fill="currentColor" stroke="none" opacity={0.6} />,
  },
  motion: {
    none: (
      <>
        {fill(14, 10, 14, 20, 0.5)}
        {fill(36, 10, 14, 20, 0.5)}
      </>
    ),
    soft: (
      <>
        {fill(14, 14, 14, 20, 0.5)}
        {fill(36, 10, 14, 20, 0.5)}
        <path d="M21 9 v-4 M18 7 l3 -3 l3 3" opacity={0.8} />
      </>
    ),
    lively: (
      <>
        {fill(6, 16, 12, 18, 0.5)}
        {fill(26, 12, 12, 18, 0.5)}
        {fill(46, 8, 12, 18, 0.5)}
        <path d="M4 6 H60" strokeDasharray="4 3" opacity={0.8} />
      </>
    ),
  },
  hero: {
    cover: (
      <>
        {fill(1, 1, 62, 38, 0.45, 2)}
        {fill(6, 20, 22, 5, 1)}
        {fill(6, 29, 10, 4, 1)}
      </>
    ),
    split: (
      <>
        {fill(1, 1, 30, 38, 0.85, 2)}
        {fill(34, 4, 27, 32, 0.35)}
      </>
    ),
    framed: (
      <>
        {page}
        {fill(6, 5, 52, 30, 0.35, 4)}
        <rect x="10" y="16" width="22" height="15" rx="2" fill="currentColor" stroke="none" />
      </>
    ),
    poster: (
      <>
        {fill(4, 4, 56, 9, 1)}
        {fill(4, 17, 56, 20, 0.35)}
      </>
    ),
    stack: (
      <>
        {fill(16, 4, 32, 6, 1)}
        {fill(26, 13, 12, 4, 0.8)}
        {fill(4, 21, 56, 16, 0.35)}
      </>
    ),
  },
} as const;
