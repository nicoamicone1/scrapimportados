import Image from "next/image";

import { StoreLink } from "@/components/store/StoreLink";
import { cn } from "@/lib/cn";
import type { Promotion } from "@/lib/pricing";
import { resolveVatPercent } from "@/lib/pricing";
import { displayPrice, type ProductCardData } from "@/lib/store/products";
import { absoluteUrl } from "@/lib/store/seo";
import { buildProductMessage, waLink } from "@/lib/store/whatsapp";
import type { StoreUrlTarget } from "@/lib/tenant/urls";
import type { Theme } from "@/lib/theme";

import { PriceTag } from "./PriceTag";
import { QuickAdd } from "./QuickAdd";

export interface ProductCardProps {
  product: ProductCardData;
  promotions: Promotion[];
  cards: Theme["cards"];
  /** % de descuento del mejor método (0 = no mostrar la línea). */
  transferPercent?: number;
  transferLabel?: string;
  /** Precio sin impuestos nacionales (null/undefined = no se muestra). */
  net?: { defaultVat: number; label: string } | null;
  /** Teléfono para "Consultar por WhatsApp" en agotados. */
  whatsappPhone?: string | null;
  /** Tienda, para la URL absoluta del producto en el mensaje de WhatsApp (sin ella va el path). */
  store?: StoreUrlTarget | null;
  /** Para la primera fila visible (LCP). */
  priority?: boolean;
  sizes?: string;
  /** Con `effects.dividers` la grilla dibuja reglas entre celdas. */
  className?: string;
}

/**
 * Card de producto (DESIGN.md §6.1): imagen → [marca] → [SKU] → nombre →
 * precio → [transferencia] → [neto]. Sin chips, sin "En stock", sin botón
 * visible por defecto (la compra rápida aparece al hover en desktop).
 */
export function ProductCard({
  product,
  promotions,
  cards,
  transferPercent = 0,
  transferLabel,
  net,
  whatsappPhone,
  store,
  priority,
  sizes,
  className,
}: ProductCardProps) {
  const price = displayPrice(product, promotions);
  const panel = cards.style !== "flat";
  const contain = cards.imageRatio === "1:1" || cards.imageRatio === "16:9";
  const fit = contain ? "pcard-img-contain" : "pcard-img-cover";
  const hover = cards.hover;
  const alt = hover === "zoom" && product.secondImage ? product.secondImage : null;
  const href = `/producto/${product.slug}`;
  const single = product.variants.length === 1 ? product.variants[0] : null;
  const imageSizes = sizes ?? "(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

  return (
    <article
      data-hover={hover}
      data-style={cards.style}
      className={cn(
        "pcard group relative flex flex-col",
        panel && "overflow-hidden rounded-lg border border-border bg-surface",
        cards.style === "elevated" && "shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className={cn("pcard-media", !panel && "rounded-lg")}>
        <div className={cn("absolute inset-0", !product.available && "opacity-55")}>
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.alt || product.name}
              fill
              priority={priority}
              sizes={imageSizes}
              className={cn(fit, "pcard-main")}
            />
          ) : null}
          {alt ? <Image src={alt.url} alt="" fill sizes={imageSizes} className={cn(fit, "pcard-alt")} aria-hidden /> : null}
        </div>
        {price.promotion?.badgeLabel ? (
          <span className="store-badge absolute top-2 left-2 z-[1] rounded-sm bg-bg px-1.5 py-0.5 text-xs font-semibold text-accent">
            {price.promotion.badgeLabel}
          </span>
        ) : null}
        <QuickAdd
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            image: product.image?.url ?? null,
            categoryIds: product.categoryIds,
            brand: product.brand,
            vatPercent: product.vatPercent,
          }}
          variant={
            single
              ? {
                  id: single.id,
                  title: single.title,
                  sku: single.sku,
                  price: single.price,
                  compareAtPrice: single.compareAtPrice,
                  maxQty: single.trackInventory && !single.allowBackorder ? Math.max(single.stock, 0) : null,
                }
              : null
          }
          hasOptions={product.hasOptions}
          available={product.available}
          whatsappHref={
            whatsappPhone ? waLink(whatsappPhone, buildProductMessage(null, { name: product.name, url: store ? absoluteUrl(store, href) : href })) : null
          }
        />
      </div>
      <div className={cn("flex flex-1 flex-col gap-1", panel ? "p-[var(--card-pad)]" : "pt-[var(--card-pad)]")}>
        {cards.showBrand && product.brand ? (
          <p className="text-xs tracking-[0.06em] text-fg-muted uppercase">{product.brand}</p>
        ) : null}
        {cards.showSku && product.sku ? <p className="font-mono text-xs text-fg-muted">{product.sku}</p> : null}
        <h3 className="line-clamp-2 min-h-[2.6em] font-body text-sm leading-[1.3] font-medium tracking-normal normal-case">
          <StoreLink href={href} className="after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-2">
            {product.name}
          </StoreLink>
        </h3>
        <PriceTag
          price={price.price}
          compareAt={price.compareAt}
          from={price.from}
          transferPercent={product.available ? transferPercent : 0}
          transferLabel={transferLabel}
          net={net && product.available ? { vat: resolveVatPercent(product.vatPercent, net.defaultVat), label: net.label } : null}
          muted={!product.available}
          size="sm"
        />
        {!product.available ? <p className="text-xs text-fg-muted">Sin stock</p> : null}
      </div>
    </article>
  );
}

/** Grilla de cards con las columnas del tema (`--grid-cols`); `columns` pisa sólo desktop. */
export function ProductGrid({
  products,
  columns,
  dividers,
  priorityCount = 4,
  ...card
}: {
  products: ProductCardData[];
  columns?: number;
  /** `effects.dividers`: reglas finas entre celdas (look de catálogo). */
  dividers?: boolean;
  priorityCount?: number;
} & Omit<ProductCardProps, "product" | "priority" | "className">) {
  return (
    <div
      className="store-grid"
      data-dividers={dividers ? "1" : undefined}
      style={columns ? ({ "--cols": columns } as React.CSSProperties) : undefined}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} {...card} priority={i < priorityCount} />
      ))}
    </div>
  );
}
