import type { CSSProperties } from "react";

import { ProductCard } from "@/components/store/ProductCard";

import { StoreButtonLink } from "./Button";
import type { BlockProps } from "./types";

/**
 * Colección destacada / lookbook (DESIGN.md §6.12): una foto grande con la
 * forma del tema y, al lado, el texto y 2 a 4 productos de la colección.
 * Sin foto, el lado grande es un plano de color con el título en grande
 * (tipográfico, no una caja vacía). Mobile: foto → texto → productos de a dos.
 */
export function Lookbook({ block, ctx, index }: BlockProps<"lookbook">) {
  const s = block.settings;
  const products = (ctx.data.products[block.id] ?? []).slice(0, 4);
  const hasImage = Boolean(s.imageUrl);

  return (
    <div className="blk-look" data-image={s.imagePosition} data-n={products.length} data-filter={ctx.theme.effects.imageFilter}>
      <div className="blk-look-media blk-shape" data-plain={hasImage ? undefined : ""}>
        {hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- URLs arbitrarias del builder. */}
            <img src={s.imageUrl} alt={s.imageAlt ?? ""} className="blk-media st-reveal-scale" loading={index === 0 ? "eager" : "lazy"} decoding="async" />
            <div aria-hidden className="blk-grain" />
          </>
        ) : (
          // Sin foto, el título va en grande en el plano de color (y no se repite al lado).
          <h2 className="blk-look-word">{s.title}</h2>
        )}
      </div>
      <div className="blk-look-side">
        <div className="st-reveal">
          {s.eyebrow ? <p className="blk-eyebrow mb-3 text-fg-muted">{s.eyebrow}</p> : null}
          {hasImage ? <h2 className="blk-title">{s.title}</h2> : null}
          {s.text ? <p className={hasImage ? "mt-3 max-w-[48ch] text-fg-muted" : "max-w-[48ch] text-fg-muted"}>{s.text}</p> : null}
        </div>
        {products.length ? (
          <div className="blk-look-grid st-stagger">
            {products.map((p, i) => (
              <div key={p.id} style={{ "--i": i } as CSSProperties} className="min-w-0">
                <ProductCard
                  product={p}
                  promotions={ctx.promotions}
                  cards={ctx.theme.cards}
                  transferPercent={ctx.theme.cards.showTransferPrice === false ? 0 : ctx.transferPercent}
                  {...ctx.cardProps}
                  priority={index === 0 && i < 2}
                  sizes="(min-width: 1024px) 18vw, 45vw"
                />
              </div>
            ))}
          </div>
        ) : null}
        {s.cta?.label ? (
          <div className="mt-auto pt-2">
            <StoreButtonLink theme={ctx.theme} href={s.cta.href || "/productos"} variant="secondary">
              {s.cta.label}
            </StoreButtonLink>
          </div>
        ) : null}
      </div>
    </div>
  );
}
