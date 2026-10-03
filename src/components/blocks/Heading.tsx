import { cn } from "@/lib/cn";
import { slugify } from "@/lib/slug";

import type { BlockProps } from "./types";

/**
 * Título de sección: eyebrow + título. El h2 toma la forma de
 * `theme.style.titles` (como los encabezados de los demás bloques); el h1 es
 * display y el h3, chico. El id (slug del texto) sirve de ancla:
 * /pagina#preguntas-frecuentes.
 */
export function Heading({ block }: BlockProps<"heading">) {
  const s = block.settings;
  if (!s.text) return null;
  const Tag = `h${s.level}` as "h1" | "h2" | "h3";
  return (
    <div
      className={cn("blk-heading st-reveal", s.align === "center" && "mx-auto text-center", s.align === "right" && "text-right")}
      data-align={s.align}
    >
      {s.eyebrow ? <p className="blk-eyebrow mb-2 text-fg-muted">{s.eyebrow}</p> : null}
      <Tag
        id={slugify(s.text) || undefined}
        className={s.level === 1 ? "blk-display" : s.level === 2 ? "blk-title blk-sectitle" : "blk-title"}
        style={s.level === 3 ? { fontSize: "var(--text-xl)" } : undefined}
      >
        {s.level === 2 ? <span>{s.text}</span> : s.text}
      </Tag>
    </div>
  );
}
