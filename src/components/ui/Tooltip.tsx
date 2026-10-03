"use client";

import { cloneElement, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface TooltipProps {
  content: ReactNode;
  /** Un solo elemento enfocable (botón, link). Se le agrega `aria-describedby`. */
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/*
 * Forma de burbuja (BRAND §7.2: los tooltips "hablan"): tres esquinas de
 * 10 px y la que mira al disparador casi recta. Entra con un corrimiento de
 * 2 px hacia afuera del disparador.
 */
const sides = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded-bl-[3px] translate-y-0.5 group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-tl-[3px] -translate-y-0.5 group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2 rounded-br-[3px] translate-x-0.5 group-hover/tooltip:translate-x-0 group-focus-within/tooltip:translate-x-0",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2 rounded-bl-[3px] -translate-x-0.5 group-hover/tooltip:translate-x-0 group-focus-within/tooltip:translate-x-0",
} as const;

/**
 * Tooltip liviano (CSS): burbuja tinta que aparece con hover y con foco de
 * teclado, asociada por `aria-describedby`. Para textos cortos; nada
 * interactivo adentro.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children, { "aria-describedby": id }) : children;
  return (
    <span className="group/tooltip relative inline-flex">
      {child}
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none invisible absolute z-50 w-max max-w-64 rounded-[10px] bg-eco-ink px-2.5 py-1.5 text-xs leading-snug text-white opacity-0 shadow-[0_8px_20px_-8px_rgb(16_22_47/0.45)] transition-[opacity,translate,visibility] delay-150 duration-[240ms] ease-eco-out group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:opacity-100",
          sides[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
