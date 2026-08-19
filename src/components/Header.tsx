"use client";

import Link from "next/link";

import { useCart } from "../lib/cart";
import { BRAND_NAME } from "../lib/config";
import HeaderSearch from "./HeaderSearch";

/** Marca: cuadrado redondeado + bolsa con un rayo (SVG inline, sin assets). */
function BrandMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-9 w-9 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" fill="rgb(255 255 255 / 0.18)" />
      <path
        d="M13 13v-2.6a3 3 0 0 1 6 0V13"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.4 12.6h13.2l1 11.1a2.4 2.4 0 0 1-2.4 2.6H10.8a2.4 2.4 0 0 1-2.4-2.6z"
        fill="white"
      />
      <path
        d="M17.6 14.9 13.4 20.9h2.7l-.8 3.9 4.2-5.6h-2.6z"
        fill="#f96a16"
      />
    </svg>
  );
}

export default function Header() {
  const { count, hydrated, openCart } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-linear-to-r from-brand-800 via-brand-700 to-brand-600 text-white shadow-md shadow-brand-950/20">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:h-16 sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-xl"
          aria-label={`${BRAND_NAME} — inicio`}
        >
          <BrandMark />
          <span className="hidden text-lg font-extrabold tracking-tight sm:block">
            {BRAND_NAME}
          </span>
        </Link>

        <HeaderSearch />

        <button
          type="button"
          onClick={openCart}
          aria-label={`Abrir carrito${hydrated && count > 0 ? ` (${count})` : ""}`}
          className="relative shrink-0 rounded-xl bg-white/15 p-2 text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/25"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17" cy="20" r="1.4" />
            <path d="M2.5 3h2.2l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.2L21 7H6" />
          </svg>

          {/* Sólo después de leer localStorage: evita mismatch de hidratación. */}
          {hydrated && count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent-600 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-brand-700 tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
