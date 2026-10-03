"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Elegir una disposición mirando su forma, no leyendo una palabra (BRAND §11:
 * "defaults inteligentes", DESIGN §6.5). Miniaturas SVG monocromas con
 * `currentColor`: el seleccionado se marca en azul (selección del panel).
 */

export interface VisualOption<T extends string> {
  value: T;
  label: string;
  /** Una línea debajo del control cuando está elegida. */
  hint?: string;
  thumb: ReactNode;
}

export function VisualChoice<T extends string>({
  label,
  value,
  onChange,
  options,
  columns = 3,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: VisualOption<T>[];
  columns?: 2 | 3;
  hint?: ReactNode;
}) {
  const id = useId();
  const current = options.find((o) => o.value === value);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[13px] font-medium text-adm-fg">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "group relative flex min-h-11 flex-col gap-1.5 rounded-adm border p-1.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-link",
                active
                  ? "border-adm-link bg-adm-accent-soft text-adm-link shadow-[inset_0_0_0_1px_var(--adm-link)]"
                  : "border-adm-border bg-adm-surface text-adm-fg-muted hover:border-adm-input-border hover:text-adm-fg",
              )}
            >
              <span className="block">{o.thumb}</span>
              <span className={cn("px-0.5 text-[12px] leading-tight", active ? "font-medium text-adm-fg" : "text-adm-fg-muted")}>{o.label}</span>
              {active ? (
                <span aria-hidden className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-adm-link text-white">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {current?.hint || hint ? <p className="text-xs text-adm-fg-muted">{hint ?? current?.hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Miniaturas (64 × 40)                                                */
/* ------------------------------------------------------------------ */

const f = (o: number) => ({ fill: "currentColor", fillOpacity: o });

function T({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 40" className="block h-auto w-full" aria-hidden>
      <rect x="0.5" y="0.5" width="63" height="39" rx="3" fill="var(--adm-surface)" stroke="currentColor" strokeOpacity=".25" />
      {children}
    </svg>
  );
}

export const HERO_THUMBS = {
  cover: (
    <T>
      <rect x="3" y="3" width="58" height="34" rx="1.5" {...f(0.22)} />
      <rect x="7" y="20" width="26" height="4" rx="1" {...f(0.85)} />
      <rect x="7" y="26" width="18" height="2" rx="1" {...f(0.5)} />
      <rect x="7" y="30.5" width="11" height="3.5" rx="1" {...f(0.9)} />
    </T>
  ),
  split: (
    <T>
      <rect x="3" y="3" width="29" height="34" rx="1.5" {...f(0.75)} />
      <rect x="7" y="15" width="18" height="3.5" rx="1" fill="var(--adm-surface)" />
      <rect x="7" y="21" width="13" height="2" rx="1" fill="var(--adm-surface)" fillOpacity=".7" />
      <rect x="7" y="26" width="9" height="3.5" rx="1" fill="var(--adm-surface)" />
      <path d="M36 37 V16 a12 12 0 0 1 24 0 V37 Z" {...f(0.22)} />
    </T>
  ),
  framed: (
    <T>
      <rect x="6" y="4" width="52" height="25" rx="3" {...f(0.22)} />
      <rect x="10" y="19" width="26" height="17" rx="2" fill="var(--adm-surface)" stroke="currentColor" strokeOpacity=".45" />
      <rect x="13" y="23" width="17" height="3" rx="1" {...f(0.85)} />
      <rect x="13" y="28.5" width="12" height="2" rx="1" {...f(0.45)} />
    </T>
  ),
  poster: (
    <T>
      <rect x="0.5" y="0.5" width="63" height="39" rx="3" {...f(0.12)} />
      <rect x="5" y="6" width="54" height="9" rx="1" {...f(0.9)} />
      <rect x="5" y="17" width="38" height="9" rx="1" {...f(0.9)} />
      <rect x="5" y="30" width="54" height="0.8" {...f(0.4)} />
      <rect x="5" y="33" width="22" height="2" rx="1" {...f(0.5)} />
      <rect x="48" y="32.5" width="11" height="3.5" rx="1" {...f(0.9)} />
    </T>
  ),
  stack: (
    <T>
      <rect x="20" y="5" width="24" height="3.5" rx="1" {...f(0.85)} />
      <rect x="24" y="10.5" width="16" height="2" rx="1" {...f(0.45)} />
      <rect x="27" y="14.5" width="10" height="3" rx="1" {...f(0.85)} />
      <rect x="0.5" y="23" width="63" height="16.5" {...f(0.1)} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={5 + i * 14} y={i % 2 ? 24 : 21} width="12" height="13" rx="1.5" {...f(0.3)} />
      ))}
    </T>
  ),
} as const;

export const CATEGORY_THUMBS = {
  cards: (
    <T>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={4 + i * 14.5} y="8" width="12.5" height="16" rx="2" {...f(0.25)} />
          <rect x={4 + i * 14.5} y="27" width="9" height="2" rx="1" {...f(0.6)} />
        </g>
      ))}
    </T>
  ),
  chips: (
    <T>
      {[
        [4, 12, 16],
        [22, 12, 13],
        [37, 12, 22],
        [4, 22, 20],
        [26, 22, 15],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height="7" rx="3.5" fill="none" stroke="currentColor" strokeOpacity=".6" />
      ))}
    </T>
  ),
  circles: (
    <T>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={10 + i * 14.5} cy="17" r="6" {...f(0.3)} />
          <rect x={6 + i * 14.5} y="27" width="8" height="2" rx="1" {...f(0.55)} />
        </g>
      ))}
    </T>
  ),
  list: (
    <T>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="4" y={6 + i * 11} width="3" height="2" rx="1" {...f(0.45)} />
          <rect x="10" y={4.5 + i * 11} width={[34, 26, 40][i]} height="5" rx="1" {...f(0.85)} />
          <rect x="4" y={12.5 + i * 11} width="56" height="0.7" {...f(0.35)} />
          <path d={`M55 ${7 + i * 11} l3 0 m-1.5 -1.5 l1.5 1.5 l-1.5 1.5`} stroke="currentColor" strokeOpacity=".6" fill="none" />
        </g>
      ))}
    </T>
  ),
} as const;

export const FEATURE_THUMBS = {
  row: (
    <T>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4 + i * 20} y="15" width="4" height="4" rx="1" fill="none" stroke="currentColor" strokeOpacity=".7" />
          <rect x={10 + i * 20} y="15.5" width="11" height="3" rx="1" {...f(0.7)} />
          <rect x={10 + i * 20} y="21" width="9" height="2" rx="1" {...f(0.35)} />
        </g>
      ))}
    </T>
  ),
  cards: (
    <T>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4 + i * 19.3} y="7" width="17" height="26" rx="2.5" {...f(0.14)} />
          <rect x={7 + i * 19.3} y="11" width="4" height="4" rx="1" fill="none" stroke="currentColor" strokeOpacity=".7" />
          <rect x={7 + i * 19.3} y="19" width="10" height="3" rx="1" {...f(0.7)} />
          <rect x={7 + i * 19.3} y="24.5" width="8" height="2" rx="1" {...f(0.35)} />
        </g>
      ))}
    </T>
  ),
  strip: (
    <T>
      <rect x="3" y="13" width="58" height="0.7" {...f(0.4)} />
      <rect x="3" y="27" width="58" height="0.7" {...f(0.4)} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          {i ? <rect x={3 + i * 14.5} y="15" width="0.7" height="10" {...f(0.4)} /> : null}
          <rect x={6 + i * 14.5} y="17.5" width="3" height="3" rx="0.8" fill="none" stroke="currentColor" strokeOpacity=".7" />
          <rect x={10.5 + i * 14.5} y="18" width="5" height="2" rx="1" {...f(0.65)} />
        </g>
      ))}
    </T>
  ),
} as const;

export const TWO_THUMBS = {
  testimonialsCards: (
    <T>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4 + i * 19.3} y="8" width="17" height="24" rx="2.5" {...f(0.12)} />
          <rect x={7 + i * 19.3} y="12" width="11" height="2" rx="1" {...f(0.55)} />
          <rect x={7 + i * 19.3} y="16" width="9" height="2" rx="1" {...f(0.55)} />
          <rect x={7 + i * 19.3} y="25" width="6" height="2" rx="1" {...f(0.8)} />
        </g>
      ))}
    </T>
  ),
  testimonialsQuote: (
    <T>
      <text x="5" y="17" fontSize="14" {...f(0.8)} fontFamily="serif">
        «
      </text>
      <rect x="6" y="18" width="48" height="4" rx="1" {...f(0.8)} />
      <rect x="6" y="24" width="36" height="4" rx="1" {...f(0.8)} />
      <rect x="6" y="32" width="12" height="2" rx="1" {...f(0.45)} />
    </T>
  ),
  faqList: (
    <T>
      <rect x="6" y="5" width="22" height="3.5" rx="1" {...f(0.8)} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="6" y={13 + i * 8} width="52" height="0.7" {...f(0.35)} />
          <rect x="6" y={15.5 + i * 8} width={[30, 24, 34][i]} height="2.2" rx="1" {...f(0.55)} />
          <rect x="54" y={16 + i * 8} width="4" height="1" {...f(0.6)} />
        </g>
      ))}
    </T>
  ),
  faqSplit: (
    <T>
      <rect x="5" y="8" width="18" height="4" rx="1" {...f(0.8)} />
      <rect x="5" y="14" width="13" height="4" rx="1" {...f(0.8)} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="29" y={7 + i * 7.5} width="30" height="0.7" {...f(0.35)} />
          <rect x="29" y={9.2 + i * 7.5} width={[18, 22, 15, 20][i]} height="2" rx="1" {...f(0.55)} />
        </g>
      ))}
    </T>
  ),
  countdownInline: (
    <T>
      <rect x="6" y="7" width="26" height="3.5" rx="1" {...f(0.75)} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={6 + i * 10} y="15" width="7" height="8" rx="1" {...f(0.8)} />
      ))}
      <rect x="6" y="28" width="14" height="4" rx="1" {...f(0.85)} />
    </T>
  ),
  countdownBanner: (
    <T>
      <rect x="5" y="5" width="22" height="3" rx="1" {...f(0.7)} />
      <rect x="4" y="11" width="56" height="0.7" {...f(0.4)} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={5 + i * 14.5} y="14" width="11" height="14" rx="1" {...f(0.85)} />
      ))}
      <rect x="4" y="31" width="56" height="0.7" {...f(0.4)} />
    </T>
  ),
  imageSplit: (
    <T>
      <rect x="4" y="6" width="32" height="28" rx="2" {...f(0.22)} />
      <rect x="40" y="13" width="18" height="3.5" rx="1" {...f(0.8)} />
      <rect x="40" y="19" width="16" height="2" rx="1" {...f(0.4)} />
      <rect x="40" y="23" width="14" height="2" rx="1" {...f(0.4)} />
    </T>
  ),
  imageOverlap: (
    <T>
      <rect x="4" y="5" width="38" height="30" rx="2" {...f(0.22)} />
      <rect x="32" y="11" width="28" height="18" rx="2" fill="var(--adm-surface)" stroke="currentColor" strokeOpacity=".45" />
      <rect x="36" y="15" width="16" height="3.5" rx="1" {...f(0.8)} />
      <rect x="36" y="21" width="18" height="2" rx="1" {...f(0.4)} />
    </T>
  ),
  gridEven: (
    <T>
      {[0, 1, 2, 3].map((i) =>
        [0, 1].map((r) => <rect key={`${i}${r}`} x={4 + i * 14.5} y={5 + r * 16} width="12.5" height="13" rx="1.5" {...f(0.25)} />),
      )}
    </T>
  ),
  gridFirst: (
    <T>
      <rect x="4" y="5" width="27" height="29" rx="1.5" {...f(0.4)} />
      {[0, 1].map((i) =>
        [0, 1].map((r) => <rect key={`${i}${r}`} x={33.5 + i * 14.5} y={5 + r * 16} width="12.5" height="13" rx="1.5" {...f(0.25)} />),
      )}
    </T>
  ),
  marqueeSm: (
    <T>
      <rect x="0.5" y="16" width="63" height="9" {...f(0.12)} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={4 + i * 21} y="19.5" width="14" height="2" rx="1" {...f(0.7)} />
          <circle cx={20.5 + i * 21} cy="20.5" r="1" {...f(0.7)} />
        </g>
      ))}
    </T>
  ),
  marqueeLg: (
    <T>
      <rect x="0.5" y="10" width="63" height="20" {...f(0.12)} />
      <rect x="-2" y="14" width="30" height="12" rx="1" {...f(0.85)} />
      <circle cx="33" cy="20" r="2" {...f(0.85)} />
      <rect x="38" y="14" width="30" height="12" rx="1" {...f(0.85)} />
    </T>
  ),
} as const;
