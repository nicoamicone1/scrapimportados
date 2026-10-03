import { slugify } from "@/lib/slug";

import type { BlockProps } from "./types";

/**
 * Preguntas frecuentes con `<details>` nativo (accesible, sin JS) + JSON-LD FAQPage.
 * - list:  título arriba y las preguntas debajo.
 * - split: título a la izquierda (fijo al scrollear en desktop) y preguntas a la derecha.
 * El título es ancla (`/#como-comprar` en la portada de fábrica).
 */
export function Faq({ block }: BlockProps<"faq">) {
  const s = block.settings;
  const items = s.items.filter((i) => i.q.trim() && i.a.trim());
  if (!items.length) return null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <div className="blk-faq" data-layout={s.layout ?? "list"}>
      {s.title ? (
        <div className="blk-faq-head">
          <h2 className="blk-title blk-sectitle" id={slugify(s.title) || undefined}>
            <span>{s.title}</span>
          </h2>
        </div>
      ) : null}
      <div className="blk-faq-list st-reveal">
        {items.map((item, i) => (
          <details key={i}>
            <summary>
              <span>{item.q}</span>
              <span aria-hidden className="blk-faq-sign" />
            </summary>
            <p className="pb-5 whitespace-pre-line text-fg-muted" style={{ maxWidth: "68ch" }}>
              {item.a}
            </p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
