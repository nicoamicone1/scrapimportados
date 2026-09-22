import type { BlockProps } from "./types";

/** Preguntas frecuentes con `<details>` nativo (accesible, sin JS) + JSON-LD FAQPage. */
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
    <div className="blk-faq">
      {s.title ? <h2 className="blk-title blk-head">{s.title}</h2> : null}
      <div>
        {items.map((item, i) => (
          <details key={i}>
            <summary>
              <span>{item.q}</span>
              <span aria-hidden className="blk-faq-sign w-4 shrink-0 text-center text-lg leading-none text-fg-muted" />
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
