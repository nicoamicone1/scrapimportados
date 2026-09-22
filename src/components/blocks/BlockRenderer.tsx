import "./blocks.css";

import { Fragment, type ReactNode } from "react";

import type { Block } from "@/lib/blocks/schema";
import { sanitizeHtml } from "@/lib/html";

import { BannerGrid } from "./BannerGrid";
import { CategoryList } from "./CategoryList";
import { Countdown } from "./Countdown";
import { Divider } from "./Divider";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { Heading } from "./Heading";
import { Hero } from "./Hero";
import { ImageText } from "./ImageText";
import { ProductGridBlock } from "./ProductGrid";
import { ProductSlider } from "./ProductSlider";
import { RichText } from "./RichText";
import { BlockDivider, BlockSection, needsDivider } from "./Section";
import { Testimonials } from "./Testimonials";
import type { BlockContext } from "./types";
import { Video } from "./Video";
import { parseVideoUrl } from "./video-url";

export type { BlockContext } from "./types";

/**
 * Render público de los bloques del builder (agente E). Server Component
 * (los interactivos —slider, cuenta regresiva, video— son islas client).
 *
 * Contrato con el storefront (S):
 *   const data = await resolveBlockData(page.blocks, promotions);
 *   <BlockRenderer blocks={page.blocks} data={data} promotions={promotions}
 *     theme={settings.theme} transferPercent={transferPercent} timezone={settings.timezone} />
 */

/** ¿El bloque no tiene nada que mostrar? (sin productos, sin ítems, cuenta vencida sin texto…). */
export function isBlockEmpty(block: Block, ctx: BlockContext): boolean {
  switch (block.type) {
    case "product_slider":
    case "product_grid":
      return !(ctx.data.products[block.id]?.length);
    case "category_list":
      return !(ctx.data.categories[block.id]?.length);
    case "testimonials":
      return !block.settings.items.some((i) => i.quote.trim() && i.author.trim());
    case "features":
      return !block.settings.items.some((i) => i.title);
    case "faq":
      return !block.settings.items.some((i) => i.q.trim() && i.a.trim());
    case "banner_grid":
      return !block.settings.items.some((i) => i.imageUrl || i.title);
    case "heading":
      return !block.settings.text;
    case "video":
      return parseVideoUrl(block.settings.url) === null;
    case "rich_text":
      return !sanitizeHtml(block.settings.html).trim();
    case "countdown": {
      const end = Date.parse(block.settings.endsAt);
      const now = (ctx.now ?? new Date()).getTime();
      return (!Number.isFinite(end) || end <= now) && !block.settings.expiredText;
    }
    default:
      return false;
  }
}

/** Contenido de un bloque (sin el contenedor de sección). `null` si no hay nada que mostrar. */
export function renderBlock(block: Block, ctx: BlockContext, index: number): ReactNode {
  if (isBlockEmpty(block, ctx)) return null;
  switch (block.type) {
    case "hero":
      return <Hero block={block} ctx={ctx} index={index} />;
    case "product_slider":
      return <ProductSlider block={block} ctx={ctx} index={index} />;
    case "product_grid":
      return <ProductGridBlock block={block} ctx={ctx} index={index} />;
    case "banner_grid":
      return <BannerGrid block={block} ctx={ctx} index={index} />;
    case "rich_text":
      return <RichText block={block} ctx={ctx} index={index} />;
    case "heading":
      return <Heading block={block} ctx={ctx} index={index} />;
    case "image_text":
      return <ImageText block={block} ctx={ctx} index={index} />;
    case "category_list":
      return <CategoryList block={block} ctx={ctx} index={index} />;
    case "features":
      return <Features block={block} ctx={ctx} index={index} />;
    case "faq":
      return <Faq block={block} ctx={ctx} index={index} />;
    case "countdown":
      return <Countdown block={block} ctx={ctx} index={index} />;
    case "testimonials":
      return <Testimonials block={block} ctx={ctx} index={index} />;
    case "video":
      return <Video block={block} ctx={ctx} index={index} />;
    case "divider":
      return <Divider block={block} ctx={ctx} index={index} />;
  }
}

export function BlockRenderer({ blocks, ...ctx }: { blocks: Block[] } & BlockContext) {
  const visible = blocks.filter((b) => !b.style.hidden && !isBlockEmpty(b, ctx));
  return (
    <>
      {visible.map((block, i) => {
        const content = renderBlock(block, ctx, i);
        if (content === null) return null;
        const divider = ctx.theme.effects.dividers && needsDivider(visible[i - 1], block);
        return (
          <Fragment key={block.id}>
            {divider ? <BlockDivider /> : null}
            <BlockSection block={block} prev={visible[i - 1]}>
              {content}
            </BlockSection>
          </Fragment>
        );
      })}
    </>
  );
}
