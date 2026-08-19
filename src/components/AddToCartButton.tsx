"use client";

import { useEffect, useRef, useState } from "react";

import { useCart, type Addable } from "../lib/cart";

/** Cuánto dura el "✓ Agregado" antes de volver al estado normal. */
const FEEDBACK_MS = 1200;

export default function AddToCartButton({
  product,
  qty = 1,
  size = "sm",
  openOnAdd = false,
}: {
  product: Addable;
  qty?: number;
  size?: "sm" | "lg";
  /** Abrir el carrito después de agregar (detalle de producto). */
  openOnAdd?: boolean;
}) {
  const { add, openCart } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // La tarjeta entera es un link: no navegar al agregar.
    event.preventDefault();
    event.stopPropagation();

    add(product, qty);
    if (openOnAdd) openCart();

    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), FEEDBACK_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className={[
        "inline-flex w-full items-center justify-center gap-1.5 rounded-xl font-semibold shadow-sm transition duration-150 active:scale-[0.98]",
        size === "lg" ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs",
        added
          ? "bg-emerald-600 text-white"
          : "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
      ].join(" ")}
    >
      {added ? (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
          Agregado
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17" cy="20" r="1.4" />
            <path d="M2.5 3h2.2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.2L21 7H6" />
          </svg>
          Agregar al carrito
        </>
      )}
    </button>
  );
}
