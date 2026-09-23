"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { StoreLink } from "@/components/store/StoreLink";
import { useCart } from "@/lib/cart";
import type { PriceTier } from "@/lib/pricing";
import { track } from "@/lib/store/analytics";

export interface QuickAddProps {
  product: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    categoryIds: string[];
    brand: string | null;
    vatPercent?: number | null;
    /** Precios por cantidad del producto (el carrito los aplica al sumar unidades). */
    priceTiers?: PriceTier[];
  };
  /** Variante única (producto simple). */
  variant: {
    id: string;
    title: string;
    sku: string | null;
    price: number;
    compareAtPrice: number | null;
    maxQty: number | null;
  } | null;
  hasOptions: boolean;
  available: boolean;
  /** Link a WhatsApp para agotados (si el método está activo). */
  whatsappHref?: string | null;
}

/**
 * Compra rápida de la card (DESIGN.md §6.1): aparece al hover/focus en
 * desktop, pegada al borde inferior de la imagen. En mobile no se muestra.
 */
export function QuickAdd({ product, variant, hasOptions, available, whatsappHref }: QuickAddProps) {
  const { add, open } = useCart();
  const [added, setAdded] = useState(false);
  const cls = "btn btn-primary pcard-quick absolute inset-x-0 bottom-0 z-10 w-full rounded-none";

  if (!available) {
    return whatsappHref ? (
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cls}>
        Consultar por WhatsApp
      </a>
    ) : null;
  }
  if (hasOptions || !variant) {
    return (
      <StoreLink href={`/producto/${product.slug}`} className={cls} tabIndex={-1}>
        Elegir opciones
      </StoreLink>
    );
  }

  const onAdd = () => {
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantTitle: variant.title === "Default" ? null : variant.title,
        sku: variant.sku,
        image: product.image,
        unitPrice: variant.price,
        compareAtPrice: variant.compareAtPrice,
        categoryIds: product.categoryIds,
        vatPercent: product.vatPercent ?? null,
        priceTiers: product.priceTiers ?? [],
        maxQty: variant.maxQty,
      },
      1,
    );
    track("add_to_cart", {
      value: variant.price,
      items: [{ item_id: variant.sku || variant.id, item_name: product.name, item_brand: product.brand, price: variant.price, quantity: 1 }],
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
    open();
  };

  return (
    <button type="button" onClick={onAdd} className={cls} aria-label={added ? `${product.name} agregado al carrito` : `Agregar ${product.name} al carrito`}>
      {added ? <Check className="size-4" aria-hidden /> : null}
      {added ? "Agregado" : "Agregar al carrito"}
    </button>
  );
}
