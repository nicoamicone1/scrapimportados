import { cn } from "@/lib/cn";
import { slugify } from "@/lib/slug";

import type { BlockProps } from "./types";

/** Título de sección: eyebrow + título, a la izquierda por defecto, sin adornos. El id (slug del texto) sirve de ancla: /pagina#preguntas-frecuentes. */
export function Heading({ block }: BlockProps<"heading">) {
  const s = block.settings;
  if (!s.text) return null;
  const Tag = `h${s.level}` as "h1" | "h2" | "h3";
  return (
    <div className={cn(s.align === "center" && "mx-auto text-center", s.align === "right" && "text-right")}>
      {s.eyebrow ? <p className="blk-eyebrow mb-2 text-fg-muted">{s.eyebrow}</p> : null}
      <Tag id={slugify(s.text) || undefined} className={s.level === 1 ? "blk-display" : "blk-title"} style={s.level === 3 ? { fontSize: "var(--text-xl)" } : undefined}>
        {s.text}
      </Tag>
    </div>
  );
}
