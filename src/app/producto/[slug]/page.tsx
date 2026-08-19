import Link from "next/link";
import { notFound } from "next/navigation";

import CategoryChips from "../../../components/CategoryChips";
import Gallery from "../../../components/Gallery";
import PriceBlock from "../../../components/PriceBlock";
import ProductBuyBox from "../../../components/ProductBuyBox";
import StockBadge from "../../../components/StockBadge";
import {
  getProductBySlug,
  getProducts,
  toCatalogItem,
} from "../../../lib/products";

// Export estático: todas las rutas se generan en build.
export const dynamicParams = false;

export function generateStaticParams() {
  return getProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };
  return {
    title: product.name,
    description: product.shortDescription || product.name,
  };
}

export default async function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const images =
    product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];

  return (
    <article className="flex flex-col gap-5">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="transition hover:text-brand-700 hover:underline">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href="/productos/"
          className="transition hover:text-brand-700 hover:underline"
        >
          Productos
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-ink-soft">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Gallery images={images} alt={product.name} />

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StockBadge inStock={product.inStock} />
            {product.onSale && (
              <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Oferta
              </span>
            )}
            <span className="font-mono text-[11px] text-muted">
              SKU {product.sku}
            </span>
          </div>

          <h1 className="text-xl font-extrabold leading-snug tracking-tight text-ink sm:text-2xl">
            {product.name}
          </h1>

          <CategoryChips categories={product.categories} />

          {/* Caja de compra */}
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
            <PriceBlock product={product} size="lg" />

            {/* Sólo los precios finales llegan al cliente (toCatalogItem). */}
            <ProductBuyBox product={toCatalogItem(product)} />

            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              >
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                <path d="m8 12.5 2.5 2.5L16 9.5" />
              </svg>
              Cerrás el pedido por WhatsApp, sin pagar nada online.
            </p>
          </div>

          {product.shortDescription && (
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                Descripción
              </h2>
              <p className="text-sm leading-relaxed text-ink-soft">
                {product.shortDescription}
              </p>
            </div>
          )}

          {product.permalink && (
            <a
              href={product.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:border-brand-300 hover:text-brand-700 sm:w-auto"
            >
              Ver en proveedor
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
