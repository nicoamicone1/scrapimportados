import type { CSSProperties } from "react";

import { ProductCard } from "@/components/store/ProductCard";

import { SectionTitle } from "./SectionTitle";
import type { BlockProps } from "./types";

/** Grilla de productos: columnas del tema en mobile/tablet; `columns` pisa desktop. */
export function ProductGridBlock({ block, ctx, index }: BlockProps<"product_grid">) {
  const s = block.settings;
  const products = ctx.data.products[block.id] ?? [];
  if (!products.length) return null;
  return (
    <>
      <SectionTitle title={s.title} subtitle={s.subtitle} href={s.viewAllHref} arrow={ctx.theme.preset === "editorial"} />
      <div className="blk-grid" style={{ "--cols": s.columns } as CSSProperties}>
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            promotions={ctx.promotions}
            cards={ctx.theme.cards}
            transferPercent={ctx.theme.cards.showTransferPrice === false ? 0 : ctx.transferPercent}
            {...ctx.cardProps}
            priority={index < 2 && i < 4}
            sizes={`(min-width: 1024px) ${Math.round(100 / s.columns)}vw, 50vw`}
          />
        ))}
      </div>
    </>
  );
}
