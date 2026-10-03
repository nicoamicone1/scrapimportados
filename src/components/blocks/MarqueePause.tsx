"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";

/** Pausa/reanuda la marquesina que lo contiene (WCAG 2.2.2: todo lo que se mueve más de 5 s se puede detener). */
export function MarqueePause() {
  const [paused, setPaused] = useState(false);
  return (
    <button
      type="button"
      className="blk-marquee-pause"
      aria-pressed={paused}
      aria-label={paused ? "Reanudar la tira de texto" : "Pausar la tira de texto"}
      onClick={(e) => {
        const next = !paused;
        setPaused(next);
        const root = e.currentTarget.closest<HTMLElement>(".blk-marquee");
        if (root) root.dataset.paused = next ? "1" : "";
      }}
    >
      {paused ? <Play aria-hidden className="size-3.5" strokeWidth={2} /> : <Pause aria-hidden className="size-3.5" strokeWidth={2} />}
    </button>
  );
}
