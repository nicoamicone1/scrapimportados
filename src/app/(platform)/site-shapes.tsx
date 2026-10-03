import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Los gestos de forma de la marca (BRAND §7.2) para el sitio fuera de la
 * home: el arco que subraya una palabra, el cuarto de círculo plano que
 * asoma de una esquina y los anillos de trazo fino. Siempre nítidos (nada
 * de blobs ni blur), decorativos (`aria-hidden`) y derivados de la panza de
 * la "e" (círculos perfectos).
 */

/** Una palabra del titular subrayada con un arco pomelo que se dibuja (máximo uno por titular). */
export function ArcWord({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      <span className="relative z-[1]">{children}</span>
      <svg
        aria-hidden
        viewBox="0 0 200 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-[0.14em] left-[-2%] h-[0.32em] w-[104%] overflow-visible text-eco-pomelo"
      >
        <path d="M4 18 C 54 4, 146 4, 196 16" fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round" pathLength={1} className="eco-draw" />
      </svg>
    </span>
  );
}

type Corner = "tl" | "tr" | "bl" | "br";

const CORNER_POS: Record<Corner, string> = {
  tl: "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
  tr: "top-0 right-0 translate-x-1/2 -translate-y-1/2",
  bl: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
  br: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
};

/**
 * Círculo plano centrado en una esquina del contenedor (que tiene que ser
 * `relative overflow-hidden`): se ve un cuarto. `className` define el color
 * (`bg-eco-durazno`, `bg-eco-pomelo`, `bg-eco-ink-2`).
 */
export function CornerArc({ corner = "tr", size = 360, className }: { corner?: Corner; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute rounded-full", CORNER_POS[corner], className ?? "bg-eco-durazno")}
      style={{ width: size, height: size }}
    />
  );
}

/** Anillos concéntricos de trazo fino (fondo de bandas y pantallas de cuenta). */
export function Rings({ size = 560, count = 5, className }: { size?: number; count?: number; className?: string }) {
  const step = 50 / (count + 1);
  return (
    <svg aria-hidden viewBox="0 0 100 100" width={size} height={size} className={cn("pointer-events-none absolute", className)}>
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={50} cy={50} r={step * (i + 1)} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
