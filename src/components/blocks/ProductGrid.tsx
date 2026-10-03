import type { CSSProperties } from "react";

import { ProductCard } from "@/components/store/ProductCard";

import { SectionTitle } from "./SectionTitle";
import type { BlockProps } from "./types";

/**
 * Grilla de productos: columnas del tema en mobile/tablet; `columns` pisa
 * desktop. `highlight: "first"`: el primero ocupa 2 × 2 (a lo ancho en mobile).
 */
export function ProductGridBlock({ block, ctx, index }: BlockProps<"product_grid">) {
  const s = block.settings;
  if (!(ctx.data.products[block.id]?.length)) return null;
  const all = ctx.data.products[block.id] ?? [];
  const highlight = s.highlight === "first" && all.length >= 3;
  // Con protagonista (2 × 2) se recorta para cerrar la última fila en computadora.
  const rest = highlight ? (all.length + 3) % s.columns : 0;
  const products = highlight && all.length - rest >= 3 ? all.slice(0, all.length - rest) : all;
  return (
    <>
      <SectionTitle title={s.title} subtitle={s.subtitle} href={s.viewAllHref} arrow={ctx.theme.preset === "editorial"} />
      <div className="blk-grid st-stagger" data-highlight={highlight ? "" : undefined} style={{ "--cols": s.columns } as CSSProperties}>
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            promotions={ctx.promotions}
            cards={ctx.theme.cards}
            transferPercent={ctx.theme.cards.showTransferPrice === false ? 0 : ctx.transferPercent}
            {...ctx.cardProps}
            priority={index < 2 && i < 4}
            sizes={highlight && i === 0 ? `(min-width: 1024px) ${Math.round(200 / s.columns)}vw, 100vw` : `(min-width: 1024px) ${Math.round(100 / s.columns)}vw, 50vw`}
          />
        ))}
      </div>
    </>
  );
}
