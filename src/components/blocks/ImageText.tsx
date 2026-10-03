import { cn } from "@/lib/cn";
import { sanitizeHtml } from "@/lib/html";

import { StoreButtonLink } from "./Button";
import type { BlockProps } from "./types";

/**
 * Imagen y texto (DESIGN.md §2.6, §6.12):
 * - split:   imagen 7/12 con la forma del tema + texto 5/12 (o invertido).
 * - overlap: foto grande y el texto en una tarjeta que la pisa.
 * En mobile la foto va arriba. Sin foto se muestra sólo el texto (nada de
 * recuadros vacíos); en `overlap` la tarjeta queda sobre un plano de color.
 */
export function ImageText({ block, ctx }: BlockProps<"image_text">) {
  const s = block.settings;
  const html = sanitizeHtml(s.html);
  const overlap = s.layout === "overlap";
  const text = (
    <div className={cn("min-w-0", overlap ? "blk-overlap-card blk-card-shape st-reveal" : "st-reveal")}>
      {s.eyebrow ? <p className="blk-eyebrow mb-3 text-fg-muted">{s.eyebrow}</p> : null}
      {s.title ? <h2 className="blk-title">{s.title}</h2> : null}
      {html ? <div className="prose-store mt-4" dangerouslySetInnerHTML={{ __html: html }} /> : null}
      {s.cta?.label ? (
        <div className="mt-6">
          <StoreButtonLink theme={ctx.theme} href={s.cta.href || "/"} variant="primary">
            {s.cta.label}
          </StoreButtonLink>
        </div>
      ) : null}
    </div>
  );

  const image = s.imageUrl ? (
    <div className={cn("blk-it-media blk-shape", overlap && "blk-overlap-media")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- URLs arbitrarias cargadas en el builder. */}
      <img src={s.imageUrl} alt={s.title} className="absolute inset-0 size-full object-cover st-reveal-scale" loading="lazy" decoding="async" />
    </div>
  ) : null;

  if (overlap) {
    return (
      <div className="blk-overlap" data-image={s.imagePosition} data-plain={image ? undefined : ""}>
        {image ?? <div aria-hidden className="blk-overlap-media blk-overlap-field blk-shape" />}
        {text}
      </div>
    );
  }
  if (!image) return <div className="max-w-[68ch]">{text}</div>;
  return (
    <div className="blk-split" data-image={s.imagePosition}>
      {image}
      {text}
    </div>
  );
}
