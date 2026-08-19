import Link from "next/link";

import type { CatalogItem } from "../lib/products";
import AddToCartButton from "./AddToCartButton";
import CategoryChips from "./CategoryChips";
import PriceBlock from "./PriceBlock";
import ProductImage from "./ProductImage";
import StockBadge from "./StockBadge";

/**
 * Tarjeta de producto. Está pensada para que todas midan lo mismo dentro de
 * una grilla o de un slider: `flex-col` + nombre clampeado a 2 líneas con
 * alto mínimo + chips a 2 + botón pegado abajo con `mt-auto`.
 */
export default function ProductCard({
  product,
  className = "",
}: {
  product: CatalogItem;
  /** Extra para el slider (ancho fijo + snap). */
  className?: string;
}) {
  const href = `/producto/${product.slug}/`;

  return (
    <li
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift ${className}`}
    >
      <Link
        href={href}
        className="relative block aspect-square overflow-hidden bg-tint p-3"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductImage
          src={product.image}
          alt={product.name}
          className="transition duration-300 group-hover:scale-[1.04]"
        />
        {product.onSale && (
          <span className="absolute left-2 top-2 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            Oferta
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
        <div className="flex items-start justify-between gap-2">
          <StockBadge inStock={product.inStock} />
          <span className="shrink-0 font-mono text-[10px] text-muted">
            {product.sku}
          </span>
        </div>

        {/* Alto fijo de 2 líneas: todas las tarjetas miden igual. */}
        <h3 className="h-10 text-[13px] font-semibold leading-5 text-ink">
          <Link
            href={href}
            className="line-clamp-2 transition hover:text-brand-700"
          >
            {product.name}
          </Link>
        </h3>

        {/* Una sola línea de chips (2 + "+N"), alto fijo. */}
        <div className="h-6 overflow-hidden">
          <CategoryChips categories={product.categories} max={2} oneLine />
        </div>

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          <PriceBlock product={product} reserveWeb />
          <AddToCartButton product={product} />
        </div>
      </div>
    </li>
  );
}
