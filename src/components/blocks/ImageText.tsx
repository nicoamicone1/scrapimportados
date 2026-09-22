import { sanitizeHtml } from "@/lib/html";

import { StoreButtonLink } from "./Button";
import type { BlockProps } from "./types";

/**
 * Imagen 7/12 + texto 5/12 (DESIGN.md §2.6). En mobile la foto va siempre
 * arriba. Sin foto se muestra sólo el texto (nada de recuadros vacíos).
 */
export function ImageText({ block, ctx }: BlockProps<"image_text">) {
  const s = block.settings;
  const html = sanitizeHtml(s.html);
  const text = (
    <div className="min-w-0">
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
  if (!s.imageUrl) return <div className="max-w-[68ch]">{text}</div>;
  return (
    <div className="blk-split" data-image={s.imagePosition}>
      <div className="relative overflow-hidden rounded-lg bg-surface" style={{ aspectRatio: "4 / 3" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- URLs arbitrarias cargadas en el builder. */}
        <img src={s.imageUrl} alt={s.title} className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" />
      </div>
      {text}
    </div>
  );
}
