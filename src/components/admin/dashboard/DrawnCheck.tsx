import { cn } from "@/lib/cn";

import "./dashboard.css";

/** Check que se dibuja una vez (BRAND §9: "los checks"). `index` escalona varios. */
export function DrawnCheck({ className, index = 0, strokeWidth = 2.5 }: { className?: string; index?: number; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-3.5", className)} fill="none">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        pathLength={1}
        className="dsh-check"
        style={{ ["--i" as string]: index }}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
