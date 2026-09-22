import { ProductCard } from "@/components/store/ProductCard";

import { SliderShell } from "./SliderShell";
import type { BlockProps } from "./types";

/** Carrusel de productos (DESIGN.md §6.8). Sin productos no se renderiza. */
export function ProductSlider({ block, ctx, index }: BlockProps<"product_slider">) {
  const s = block.settings;
  const products = ctx.data.products[block.id] ?? [];
  if (!products.length) return null;
  const mobilePeek = ctx.theme.layout.gridColumns.mobile === 1 ? 1.3 : 2.3;
  return (
    <SliderShell
      title={s.title}
      subtitle={s.subtitle}
      href={s.viewAllHref}
      arrow={ctx.theme.preset === "editorial"}
      perView={s.cardsPerView}
      mobilePeek={mobilePeek}
    >
      {products.map((p, i) => (
        <div key={p.id}>
          <ProductCard
            product={p}
            promotions={ctx.promotions}
            cards={ctx.theme.cards}
            transferPercent={ctx.theme.cards.showTransferPrice === false ? 0 : ctx.transferPercent}
            {...ctx.cardProps}
            priority={index < 2 && i < 2}
            sizes={`(min-width: 1024px) ${Math.round(100 / s.cardsPerView)}vw, 44vw`}
          />
        </div>
      ))}
    </SliderShell>
  );
}
