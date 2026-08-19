"use client";

import { useState } from "react";

import type { Addable } from "../lib/cart";
import AddToCartButton from "./AddToCartButton";

/** Selector de cantidad + "Agregar al carrito" del detalle de producto. */
export default function ProductBuyBox({ product }: { product: Addable }) {
  const [qty, setQty] = useState(1);

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <div className="inline-flex items-center self-start rounded-xl border border-line bg-white">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Restar uno"
          className="rounded-l-xl px-3.5 py-2.5 text-lg leading-none text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
        >
          −
        </button>
        <span className="min-w-10 px-1 text-center text-sm font-bold tabular-nums text-ink">
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(99, q + 1))}
          aria-label="Sumar uno"
          className="rounded-r-xl px-3.5 py-2.5 text-lg leading-none text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
        >
          +
        </button>
      </div>

      <div className="sm:flex-1">
        <AddToCartButton product={product} qty={qty} size="lg" openOnAdd />
      </div>
    </div>
  );
}
