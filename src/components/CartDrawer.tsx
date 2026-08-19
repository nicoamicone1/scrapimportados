"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useCart } from "../lib/cart";
import CartView from "./CartView";

/** Slide-over desde la derecha. Vive en el layout, lo abre el header. */
export default function CartDrawer() {
  const { isOpen, closeCart, count } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCart();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carrito">
      <button
        type="button"
        onClick={closeCart}
        aria-label="Cerrar carrito"
        className="absolute inset-0 h-full w-full cursor-default bg-ink/50 backdrop-blur-[2px]"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-linear-to-r from-brand-800 to-brand-600 px-4 py-3 text-white">
          <h2 className="text-sm font-extrabold tracking-tight">
            Carrito{count > 0 ? ` (${count})` : ""}
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href="/carrito/"
              onClick={closeCart}
              className="text-xs font-semibold text-white/80 underline underline-offset-4 transition hover:text-white"
            >
              Ver página
            </Link>
            <button
              type="button"
              onClick={closeCart}
              aria-label="Cerrar"
              className="rounded-lg p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <CartView onNavigate={closeCart} />
        </div>
      </aside>
    </div>
  );
}
