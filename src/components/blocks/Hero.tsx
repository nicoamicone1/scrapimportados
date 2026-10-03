import type { CSSProperties, ReactNode } from "react";

import { ProductCard } from "@/components/store/ProductCard";
import { StoreLink } from "@/components/store/StoreLink";
import { resolveHeroLayout } from "@/lib/blocks/hero";
import type { BlockOf } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { displayPrice, type ProductCardData } from "@/lib/store/products";

import { StoreButtonLink } from "./Button";
import type { BlockContext, BlockProps } from "./types";

/**
 * Portada (DESIGN.md §6.5) en cinco disposiciones. `layout: "auto"` sigue
 * `theme.style.hero`; las demás las fija el dueño en el bloque.
 *
 * - cover:  foto a sangre con el texto encima (sin foto → se compone como poster).
 * - split:  mitad texto sobre el color primario, mitad foto con la forma del tema
 *           (sin foto → collage de productos; sin productos → monograma).
 * - framed: foto enmarcada en el contenedor y el texto en una tarjeta que la pisa.
 * - poster: titular gigante a lo ancho, foto opcional como franja (o productos).
 * - stack:  titular centrado y debajo una tira de productos o la foto.
 *
 * Todas responden con container queries (tienda y vista previa del panel) y
 * entran con movimiento según `theme.style.motion` (`.blk-in`, sin JS).
 */

type HeroSettings = BlockOf<"hero">["settings"];

/** Tamaño del titular según el largo: un nombre corto puede ocupar todo el ancho. */
function titleScale(title: string): "xl" | "lg" | "md" {
  const n = title.trim().length;
  return n <= 14 ? "xl" : n <= 30 ? "lg" : "md";
}

function HeroTitle({ s, index, className }: { s: HeroSettings; index: number; className?: string }) {
  const Tag = index === 0 ? "h1" : "h2";
  return (
    <Tag className={cn("blk-hero-title blk-in", className)} style={{ "--i": 1 } as CSSProperties}>
      {s.title}
    </Tag>
  );
}

function Ctas({ s, ctx, onImage, center, i = 3 }: { s: HeroSettings; ctx: BlockContext; onImage?: boolean; center?: boolean; i?: number }) {
  if (!s.cta.label && !s.cta2?.label) return null;
  return (
    <div className={cn("blk-hero-ctas blk-in", center && "justify-center")} style={{ "--i": i } as CSSProperties}>
      {s.cta.label ? (
        <StoreButtonLink theme={ctx.theme} href={s.cta.href || "/productos"} variant={onImage ? "onImage" : "primary"}>
          {s.cta.label}
        </StoreButtonLink>
      ) : null}
      {s.cta2?.label ? (
        <StoreButtonLink theme={ctx.theme} href={s.cta2.href || "/"} variant="link">
          {s.cta2.label}
        </StoreButtonLink>
      ) : null}
    </div>
  );
}

function Eyebrow({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="blk-eyebrow blk-in mb-3" style={{ "--i": 0 } as CSSProperties}>
      {text}
    </p>
  );
}

function Subtitle({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <p className={cn("blk-hero-sub blk-in", className)} style={{ "--i": 2 } as CSSProperties}>
      {text}
    </p>
  );
}

/** Foto de la portada (con fuente mobile si la hay). */
function HeroPicture({ s, ctx, priority, className }: { s: HeroSettings; ctx: BlockContext; priority: boolean; className?: string }) {
  const src = ctx.device === "mobile" && s.imageUrlMobile ? s.imageUrlMobile : s.imageUrl;
  return (
    <picture>
      {s.imageUrlMobile && !ctx.device ? <source media="(max-width: 767px)" srcSet={s.imageUrlMobile} /> : null}
      { }
      <img
        src={src}
        alt={s.imageAlt ?? ""}
        className={cn("blk-media blk-in-media", className)}
        fetchPriority={priority ? "high" : undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}

/** Foto de producto con nombre y precio: la vidriera cuando la portada no tiene foto propia. */
function ProductTile({ p, ctx, i, eager }: { p: ProductCardData; ctx: BlockContext; i: number; eager: boolean }) {
  const price = displayPrice(p, ctx.promotions);
  return (
    <StoreLink href={`/producto/${p.slug}`} className="blk-hero-tile st-hover-lift blk-in" style={{ "--i": 2 + i } as CSSProperties}>
      <span className="blk-hero-tile-img blk-shape-sm">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del catálogo (Storage o URL importada).
          <img src={p.image.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
        ) : null}
      </span>
      <span className="blk-hero-tile-cap">
        <span className="blk-hero-tile-name">{p.name}</span>
        <span className="blk-hero-tile-price tnum">
          {price.from ? "Desde " : ""}
          {formatMoney(price.price)}
        </span>
      </span>
    </StoreLink>
  );
}

const withImages = (products: ProductCardData[]) => products.filter((p) => p.image);

function Collage({ products, ctx, eager, max = 4 }: { products: ProductCardData[]; ctx: BlockContext; eager: boolean; max?: number }) {
  const items = withImages(products).slice(0, max);
  if (!items.length) return null;
  return (
    <div className="blk-collage" data-n={items.length}>
      {items.map((p, i) => (
        <ProductTile key={p.id} p={p} ctx={ctx} i={i} eager={eager && i < 2} />
      ))}
    </div>
  );
}

/** Lista de precios (estilo con tarjetas en fila, p. ej. Galpón): la portada ya muestra precios. */
function PriceList({ products, ctx }: { products: ProductCardData[]; ctx: BlockContext }) {
  const items = products.slice(0, 6);
  return (
    <div className="blk-pricelist">
      <p className="blk-pricelist-head">
        <span>Producto</span>
        <span>Precio</span>
      </p>
      <ul>
        {items.map((p, i) => {
          const price = displayPrice(p, ctx.promotions);
          return (
            <li key={p.id} className="blk-in" style={{ "--i": 2 + i } as CSSProperties}>
              <StoreLink href={`/producto/${p.slug}`} className="blk-pricelist-row">
                <span className="blk-pricelist-img">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto del catálogo.
                    <img src={p.image.url} alt="" loading="lazy" decoding="async" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="blk-pricelist-name">{p.name}</span>
                  {p.sku ? <span className="blk-pricelist-sku tnum">{p.sku}</span> : null}
                </span>
                <span className="blk-pricelist-price tnum">
                  {price.compareAt ? <s className="blk-pricelist-was">{formatMoney(price.compareAt)}</s> : null}
                  {formatMoney(price.price)}
                </span>
              </StoreLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Sin foto ni productos: la inicial de la tienda en grande, con la forma del tema. */
function Monogram({ text }: { text: string }) {
  const letter = (text.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "").toUpperCase();
  return (
    <div aria-hidden className="blk-monogram blk-shape">
      <span>{letter}</span>
    </div>
  );
}

function overlayFor(s: HeroSettings): string {
  const a = s.overlay / 100;
  return s.align === "center"
    ? `rgb(0 0 0 / ${a})`
    : `linear-gradient(to top right, rgb(0 0 0 / ${a}) 0%, rgb(0 0 0 / ${(a * 0.3).toFixed(3)}) 60%)`;
}

/* ------------------------------------------------------------------ cover */
function Cover({ s, ctx, index }: { s: HeroSettings; ctx: BlockContext; index: number }) {
  const center = s.align === "center";
  return (
    <div className="blk-hero blk-on-image" data-layout="cover" data-h={s.height} data-filter={ctx.theme.effects.imageFilter}>
      <div className="blk-hero-media">
        <HeroPicture s={s} ctx={ctx} priority={index === 0} />
        <div aria-hidden className="absolute inset-0" style={{ background: overlayFor(s) }} />
        <div aria-hidden className="blk-grain" />
      </div>
      <div className={cn("blk-hero-text store-container", center ? "items-center justify-center text-center" : "items-end")}>
        <div className={cn("blk-hero-copy", center && "mx-auto")}>
          <Eyebrow text={s.eyebrow} />
          <HeroTitle s={s} index={index} className={titleScale(s.title) === "xl" ? "blk-hero-title-lg" : undefined} />
          <Subtitle text={s.subtitle} className={center ? "mx-auto" : undefined} />
          <Ctas s={s} ctx={ctx} onImage center={center} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- poster */
function Poster({ s, ctx, index, products }: { s: HeroSettings; ctx: BlockContext; index: number; products: ProductCardData[] }) {
  const center = s.align === "center";
  const strip = !s.imageUrl ? withImages(products).slice(0, 4) : [];
  return (
    <div className="blk-hero" data-layout="poster" data-h={s.height} data-filter={ctx.theme.effects.imageFilter}>
      <div className={cn("store-container blk-poster", center && "text-center")}>
        <div className={cn("blk-poster-top", center && "justify-center")}>
          <Eyebrow text={s.eyebrow} />
        </div>
        <HeroTitle s={s} index={index} className={cn("blk-poster-title", `blk-poster-${titleScale(s.title)}`)} />
        <div className={cn("blk-poster-foot", center && "blk-poster-foot-center")}>
          <Subtitle text={s.subtitle} className={center ? "mx-auto" : undefined} />
          <Ctas s={s} ctx={ctx} center={center} />
        </div>
        {s.imageUrl ? (
          <div className="blk-poster-band blk-shape blk-in" style={{ "--i": 3 } as CSSProperties}>
            <HeroPicture s={s} ctx={ctx} priority={index === 0} />
            <div aria-hidden className="blk-grain" />
          </div>
        ) : strip.length ? (
          <Collage products={strip} ctx={ctx} eager={index === 0} />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ split */
function Split({ s, ctx, index, products }: { s: HeroSettings; ctx: BlockContext; index: number; products: ProductCardData[] }) {
  const hasImage = Boolean(s.imageUrl);
  const rows = ctx.theme.style.card === "row";
  const collage =
    !hasImage && products.length && rows ? (
      <PriceList products={products} ctx={ctx} />
    ) : !hasImage && withImages(products).length ? (
      <Collage products={products} ctx={ctx} eager={index === 0} />
    ) : null;
  return (
    <div className="blk-hero" data-layout="split" data-h={s.height} data-filter={ctx.theme.effects.imageFilter}>
      <div className="blk-split-text blk-bg-primary">
        <div className="blk-hero-copy">
          <Eyebrow text={s.eyebrow} />
          <HeroTitle s={s} index={index} />
          <Subtitle text={s.subtitle} />
          <Ctas s={s} ctx={ctx} />
        </div>
      </div>
      <div className="blk-split-media" data-kind={hasImage ? "image" : collage ? "products" : "mark"}>
        {hasImage ? (
          <div className="blk-split-frame blk-shape">
            <HeroPicture s={s} ctx={ctx} priority={index === 0} />
            <div aria-hidden className="blk-grain" />
          </div>
        ) : (
          (collage ?? <Monogram text={s.eyebrow || s.title} />)
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- framed */
function Framed({ s, ctx, index, products }: { s: HeroSettings; ctx: BlockContext; index: number; products: ProductCardData[] }) {
  const hasImage = Boolean(s.imageUrl);
  const right = s.align === "center";
  const collage = !hasImage && withImages(products).length ? <Collage products={products} ctx={ctx} eager={index === 0} max={3} /> : null;
  return (
    <div className="blk-hero" data-layout="framed" data-h={s.height} data-filter={ctx.theme.effects.imageFilter}>
      <div className="store-container blk-framed">
        <div className={cn("blk-framed-frame blk-shape", !hasImage && "blk-framed-plain")} data-solo={!hasImage && !collage ? "" : undefined}>
          {hasImage ? (
            <>
              <HeroPicture s={s} ctx={ctx} priority={index === 0} />
              <div aria-hidden className="blk-grain" />
            </>
          ) : (
            (collage ?? <Monogram text={s.eyebrow || s.title} />)
          )}
        </div>
        <div className={cn("blk-framed-card blk-card-shape", right && "blk-framed-card-right")}>
          <Eyebrow text={s.eyebrow} />
          <HeroTitle s={s} index={index} />
          <Subtitle text={s.subtitle} />
          <Ctas s={s} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ stack */
function Stack({ s, ctx, index, products }: { s: HeroSettings; ctx: BlockContext; index: number; products: ProductCardData[] }) {
  const cards = products.slice(0, 4);
  let below: ReactNode = null;
  if (cards.length) {
    below = (
      <div className="blk-stack-cards" data-n={cards.length}>
        {cards.map((p, i) => (
          <div key={p.id} className="blk-in" style={{ "--i": 3 + i } as CSSProperties}>
            <ProductCard
              product={p}
              promotions={ctx.promotions}
              cards={ctx.theme.cards}
              transferPercent={ctx.theme.cards.showTransferPrice === false ? 0 : ctx.transferPercent}
              {...ctx.cardProps}
              priority={index === 0 && i < 2}
              sizes="(min-width: 1024px) 22vw, 45vw"
            />
          </div>
        ))}
      </div>
    );
  } else if (s.imageUrl) {
    below = (
      <div className="blk-stack-band blk-shape blk-in" style={{ "--i": 3 } as CSSProperties}>
        <HeroPicture s={s} ctx={ctx} priority={index === 0} />
        <div aria-hidden className="blk-grain" />
      </div>
    );
  }
  return (
    <div className="blk-hero" data-layout="stack" data-h={s.height} data-below={below ? "" : undefined} data-filter={ctx.theme.effects.imageFilter}>
      <div className="store-container">
        <div className="blk-stack-head">
          <Eyebrow text={s.eyebrow} />
          <HeroTitle s={s} index={index} />
          <Subtitle text={s.subtitle} className="mx-auto" />
          <Ctas s={s} ctx={ctx} center />
        </div>
        {below}
      </div>
    </div>
  );
}

export function Hero({ block, ctx, index }: BlockProps<"hero">) {
  const s = block.settings;
  const products = ctx.data.products[block.id] ?? [];
  const layout = resolveHeroLayout(s, ctx.theme.style.hero);
  switch (layout) {
    case "cover":
      return <Cover s={s} ctx={ctx} index={index} />;
    case "poster":
      return <Poster s={s} ctx={ctx} index={index} products={products} />;
    case "split":
      return <Split s={s} ctx={ctx} index={index} products={products} />;
    case "framed":
      return <Framed s={s} ctx={ctx} index={index} products={products} />;
    case "stack":
      return <Stack s={s} ctx={ctx} index={index} products={products} />;
  }
}
