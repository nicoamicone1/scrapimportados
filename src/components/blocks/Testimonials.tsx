import type { CSSProperties } from "react";

import type { BlockProps } from "./types";

/**
 * Reseñas reales (nace vacío; sin estrellas generadas). Sin ítems no se renderiza.
 * - cards: varias en columnas, cada una en una tarjeta con la forma chica del tema.
 * - quote: la primera como cita grande en la fuente de títulos; el resto, debajo.
 */
export function Testimonials({ block }: BlockProps<"testimonials">) {
  const items = block.settings.items.filter((i) => i.quote.trim() && i.author.trim());
  if (!items.length) return null;
  const author = (item: (typeof items)[number]) => (
    <figcaption className="mt-3 text-sm">
      <span style={{ fontWeight: "var(--body-strong-weight)" }}>{item.author}</span>
      {item.meta ? <span className="text-fg-muted"> · {item.meta}</span> : null}
    </figcaption>
  );

  if (block.settings.layout === "quote") {
    const [first, ...rest] = items;
    return (
      <div className="blk-quote">
        <figure className="st-reveal">
          <span aria-hidden className="blk-quote-mark">
            «
          </span>
          <blockquote className="blk-quote-text">{first.quote}</blockquote>
          {author(first)}
        </figure>
        {rest.length ? (
          <ul className="blk-cols st-stagger mt-10" style={{ "--m-cols": 1, "--t-cols": 2, "--cols": Math.min(rest.length, 3), gap: "calc(var(--gap-grid) * 2)" } as CSSProperties}>
            {rest.map((item, i) => (
              <li key={i} style={{ "--i": i } as CSSProperties}>
                <figure>
                  <blockquote className="text-fg-muted">«{item.quote}»</blockquote>
                  {author(item)}
                </figure>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const cols = Math.min(items.length, 3);
  return (
    <ul
      className="blk-cols st-stagger"
      style={{ "--m-cols": 1, "--t-cols": Math.min(cols, 2), "--cols": cols, gap: "var(--gap-grid)" } as CSSProperties}
    >
      {items.map((item, i) => (
        <li key={i} className="blk-review blk-card-shape" style={{ "--i": i } as CSSProperties}>
          <figure>
            <blockquote className="heading text-lg" style={{ lineHeight: 1.35, textTransform: "none", letterSpacing: 0 }}>
              «{item.quote}»
            </blockquote>
            {author(item)}
          </figure>
        </li>
      ))}
    </ul>
  );
}
