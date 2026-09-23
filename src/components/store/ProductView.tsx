"use client";

import { Check } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { useCart } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { applyPromotions, priceWithDiscount, type Promotion } from "@/lib/pricing";
import { track } from "@/lib/store/analytics";
import type { ProductOption, StoreVariant } from "@/lib/store/products";

import { PriceTag } from "./PriceTag";
import { ProductGallery, type GalleryImage } from "./ProductGallery";
import { QtyStepper } from "./QtyStepper";
import { StockAlertForm } from "./StockAlertForm";

export interface ProductViewProps {
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    categoryIds: string[];
    vatPercent: number | null;
    options: ProductOption[];
    variants: StoreVariant[];
    images: GalleryImage[];
  };
  promotions: Promotion[];
  initialVariantId: string | null;
  transferPercent: number;
  transferLabel: string;
  /** Alícuota ya resuelta + leyenda (null = no se muestra). */
  net: { vat: number; label: string } | null;
  lowStockThreshold: number;
  paymentMethods: { name: string; discountPercent: number; type: string }[];
  whatsappHref: string | null;
  contain: boolean;
  /** Entrega, descripción, ficha técnica (render del server). */
  children?: ReactNode;
}

/** Artículo para "Elegí un talle" / "Elegí una opción". */
function choosePrompt(name: string): string {
  const n = name.trim().toLowerCase();
  const feminine = /(a|ión|dad|tud)$/.test(n) && n !== "talla";
  return `Elegí ${feminine ? "una" : "un"} ${n}`;
}

function setUrlVariant(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("variant", id);
  else url.searchParams.delete("variant");
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Galería 7/12 + buy box 5/12 (DESIGN.md §6.3), con variantes por opción. Las
 * dos columnas son sticky: la galería ya entra en el viewport, así que la más
 * corta acompaña mientras se lee la otra (fotos junto a la descripción larga,
 * o buy box junto a muchas fotos). Sin tope de ancho en el buy box: 5/12 de
 * `wide` da ~600px ≈ 68ch y el texto corrido ya tiene su medida (`.prose-store`).
 */
export function ProductView({
  product,
  promotions,
  initialVariantId,
  transferPercent,
  transferLabel,
  net,
  lowStockThreshold,
  paymentMethods,
  whatsappHref,
  contain,
  children,
}: ProductViewProps) {
  const { add, open } = useCart();
  const { options, variants } = product;

  const initial = useMemo<Record<string, string>>(() => {
    const byUrl = initialVariantId ? variants.find((v) => v.id === initialVariantId) : undefined;
    if (byUrl) return byUrl.optionValues;
    if (variants.length === 1) return variants[0].optionValues;
    // Opciones con un solo valor se eligen solas.
    const auto: Record<string, string> = {};
    for (const o of options) if (o.values.length === 1) auto[o.name] = o.values[0];
    return auto;
  }, [initialVariantId, variants, options]);

  const [selected, setSelected] = useState<Record<string, string>>(initial);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showMethods, setShowMethods] = useState(false);

  const variant = useMemo(() => {
    if (variants.length === 1) return variants[0];
    if (!options.length) return variants[0];
    if (!options.every((o) => selected[o.name])) return undefined;
    return variants.find((v) => options.every((o) => v.optionValues[o.name] === selected[o.name]));
  }, [options, variants, selected]);

  const missing = options.find((o) => !selected[o.name]);

  const priced = (v: StoreVariant) =>
    applyPromotions({ id: v.id, price: v.price, compareAtPrice: v.compareAtPrice }, { id: product.id, categoryIds: product.categoryIds }, promotions);

  // Precio mostrado: el de la variante elegida o el mínimo disponible ("Desde").
  const shown = (() => {
    if (variant) return { ...priced(variant), from: false };
    const pool = variants.filter((v) => v.available);
    const list = (pool.length ? pool : variants).map(priced);
    const min = list.reduce((a, b) => (b.price < a.price ? b : a), list[0]);
    return { ...min, from: list.some((p) => p.price !== min.price) };
  })();

  const maxQty = variant && variant.trackInventory && !variant.allowBackorder ? Math.max(variant.stock, 0) : null;
  const canBuy = Boolean(variant?.available);
  const soldOut = !variants.some((v) => v.available);
  const lowStock =
    variant && variant.trackInventory && !variant.allowBackorder && variant.available && variant.stock <= (variant.lowStockThreshold ?? lowStockThreshold);

  /** ¿Existe una variante disponible con este valor + lo ya elegido en las otras opciones? */
  const valueAvailable = (optionName: string, value: string) =>
    variants.some(
      (v) =>
        v.available &&
        v.optionValues[optionName] === value &&
        options.every((o) => o.name === optionName || !selected[o.name] || v.optionValues[o.name] === selected[o.name]),
    );
  const valueExists = (optionName: string, value: string) => variants.some((v) => v.optionValues[optionName] === value);

  const choose = (optionName: string, value: string) => {
    const next = { ...selected, [optionName]: value };
    // Si la combinación no existe, se sueltan las otras opciones incompatibles.
    for (const o of options) {
      if (o.name === optionName || !next[o.name]) continue;
      // Se suelta si la combinación no existe o está agotada (la persona vuelve a elegir).
      const ok = variants.some((v) => v.available && v.optionValues[optionName] === value && v.optionValues[o.name] === next[o.name]);
      if (!ok) delete next[o.name];
    }
    setSelected(next);
    setQty(1);
    const match = options.every((o) => next[o.name]) ? variants.find((v) => options.every((o) => v.optionValues[o.name] === next[o.name])) : undefined;
    setUrlVariant(match?.id ?? null);
  };

  const onAdd = () => {
    if (!variant || !canBuy) return;
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantTitle: variant.title === "Default" ? null : variant.title,
        sku: variant.sku,
        image: (variant.imageId ? product.images.find((i) => i.id === variant.imageId)?.url : undefined) ?? product.images[0]?.url ?? null,
        unitPrice: variant.price,
        compareAtPrice: variant.compareAtPrice,
        categoryIds: product.categoryIds,
        vatPercent: product.vatPercent,
        maxQty,
      },
      qty,
    );
    track("add_to_cart", {
      value: shown.price * qty,
      items: [
        {
          item_id: variant.sku || variant.id,
          item_name: product.name,
          item_variant: variant.title === "Default" ? null : variant.title,
          item_brand: product.brand,
          price: shown.price,
          quantity: qty,
        },
      ],
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
    open();
  };

  const sku = variant?.sku ?? (variants.length === 1 ? variants[0].sku : null);

  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
          <ProductGallery images={product.images} name={product.name} activeId={variant?.imageId ?? null} contain={contain} />
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
          {product.brand || sku ? (
            <p className="flex flex-wrap gap-x-3 text-xs text-fg-muted">
              {product.brand ? <span className="tracking-[0.06em] uppercase">{product.brand}</span> : null}
              {sku ? <span className="font-mono">SKU {sku}</span> : null}
            </p>
          ) : null}
          <h1 className="h-page mt-1.5">{product.name}</h1>

          <PriceTag
            className="mt-4"
            size="lg"
            price={shown.price}
            compareAt={shown.compareAt}
            from={shown.from}
            transferPercent={soldOut ? 0 : transferPercent}
            transferLabel={transferLabel}
            net={net && !soldOut ? net : null}
            muted={soldOut}
            extra={
              paymentMethods.length > 1 ? (
                <button type="button" className="link text-fg-muted" aria-expanded={showMethods} onClick={() => setShowMethods((s) => !s)}>
                  Ver medios de pago
                </button>
              ) : null
            }
          />
          {showMethods ? (
            <ul className="mt-3 space-y-1.5 rounded-md border border-border p-3 text-sm">
              {paymentMethods.map((m) => (
                <li key={m.name} className="tnum flex justify-between gap-4">
                  <span>
                    {m.type === "whatsapp" ? "Acordás el pago con el vendedor por WhatsApp" : m.name}
                    {m.discountPercent > 0 ? <span className="text-fg-muted"> · {m.discountPercent}&nbsp;% off</span> : null}
                  </span>
                  <span className="font-semibold">{formatMoney(Math.round(priceWithDiscount(shown.price, m.discountPercent)))}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 space-y-5 border-t border-border pt-6">
            {options.map((option) => (
              <fieldset key={option.name}>
                <legend className="mb-2 text-sm font-medium">
                  {option.name}
                  {selected[option.name] ? <span className="font-normal text-fg-muted">: {selected[option.name]}</span> : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {option.values.filter((v) => valueExists(option.name, v)).map((value) => {
                    const active = selected[option.name] === value;
                    const available = valueAvailable(option.name, value);
                    const anyStock = variants.some((v) => v.available && v.optionValues[option.name] === value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        data-unavailable={available ? undefined : "1"}
                        onClick={() => choose(option.name, value)}
                        disabled={!anyStock && !soldOut}
                        className="chip"
                        aria-label={available ? `${option.name} ${value}` : `${option.name} ${value}, sin stock`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {variant && !variant.available ? (
              <p className="text-sm text-danger">
                {options.length ? `${variant.title} sin stock` : "Sin stock"}
              </p>
            ) : lowStock && variant ? (
              <p className="text-sm text-fg-muted">{variant.stock === 1 ? "Queda 1" : `Quedan ${variant.stock}`}</p>
            ) : null}

            <div className="flex gap-3">
              {canBuy ? <QtyStepper value={qty} max={maxQty} size="md" label={product.name} onChange={(q) => setQty(Math.max(1, q))} /> : null}
              <button type="button" onClick={onAdd} disabled={!canBuy} className="btn btn-primary flex-1" aria-live="polite">
                {added ? <Check className="size-4" aria-hidden /> : null}
                {soldOut ? "Sin stock" : missing ? choosePrompt(missing.name) : !canBuy ? "Sin stock" : added ? "Agregado" : "Agregar al carrito"}
              </button>
            </div>
            {variant && !variant.available ? (
              <StockAlertForm key={variant.id} productId={product.id} variantId={variant.id} />
            ) : soldOut ? (
              <StockAlertForm key="product" productId={product.id} variantId={null} />
            ) : null}
            {(soldOut || (variant && !variant.available)) && whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-block">
                Consultar por WhatsApp
              </a>
            ) : null}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

export function DetailSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-8 border-t border-border pt-6", className)}>
      <h2 className="font-body text-base font-semibold tracking-normal normal-case">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
