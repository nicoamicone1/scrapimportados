import type { CSSProperties } from "react";

import type { BlockProps } from "./types";

/** Reseñas reales (nace vacío; sin estrellas generadas). Sin ítems no se renderiza. */
export function Testimonials({ block }: BlockProps<"testimonials">) {
  const items = block.settings.items.filter((i) => i.quote.trim() && i.author.trim());
  if (!items.length) return null;
  const cols = Math.min(items.length, 3);
  return (
    <ul
      className="blk-cols"
      style={{ "--m-cols": 1, "--t-cols": Math.min(cols, 2), "--cols": cols, gap: "calc(var(--gap-grid) * 2)" } as CSSProperties}
    >
      {items.map((item, i) => (
        <li key={i}>
          <figure>
            <blockquote className="heading text-lg" style={{ lineHeight: 1.35, textTransform: "none", letterSpacing: 0 }}>
              «{item.quote}»
            </blockquote>
            <figcaption className="mt-3 text-sm">
              <span style={{ fontWeight: "var(--body-strong-weight)" }}>{item.author}</span>
              {item.meta ? <span className="text-fg-muted"> · {item.meta}</span> : null}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
