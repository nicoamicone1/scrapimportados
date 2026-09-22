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

const sides = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
} as const;

/**
 * Tooltip liviano (CSS): aparece con hover y con foco de teclado, y queda
 * asociado por `aria-describedby`. Para textos cortos; nada interactivo adentro.
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
          "pointer-events-none invisible absolute z-50 w-max max-w-64 rounded-[4px] bg-adm-fg px-2 py-1 text-xs leading-snug text-white opacity-0 transition-opacity delay-150 duration-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:opacity-100",
          sides[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
