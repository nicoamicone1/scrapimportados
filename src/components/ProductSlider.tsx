"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CatalogItem } from "../lib/products";
import ProductCard from "./ProductCard";
import SectionHeader from "./SectionHeader";

/**
 * Fila horizontal con scroll-snap y flechas. Sin librerías: es un
 * `overflow-x-auto` normal + `scrollBy` en los botones.
 *
 * La barra nativa se oculta (`.no-scrollbar`) pero el scroll táctil y el
 * snap siguen funcionando. Las flechas van pegadas a los bordes, encima del
 * track, y avanzan una "página" (el ancho visible) por click.
 */
export default function ProductSlider({
  title,
  href,
  items,
  band = false,
}: {
  title: string;
  href: string;
  items: CatalogItem[];
  /** Banda de fondo tenue, para alternar secciones. */
  band?: boolean;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <section
      className={[
        "-mx-4 px-4 py-5 sm:rounded-3xl",
        band ? "bg-brand-50/70" : "",
      ].join(" ")}
    >
      <SectionHeader title={title} href={href} />

      <div className="relative">
        <ul
          ref={trackRef}
          onScroll={updateArrows}
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-smooth px-4 py-1"
        >
          {items.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              className="w-40 shrink-0 snap-start sm:w-52"
            />
          ))}
        </ul>

        <Arrow
          direction="prev"
          disabled={!canPrev}
          onClick={() => scrollByPage(-1)}
        />
        <Arrow
          direction="next"
          disabled={!canNext}
          onClick={() => scrollByPage(1)}
        />
      </div>
    </section>
  );
}

function Arrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Anterior" : "Siguiente"}
      className={[
        "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-white/95 text-ink shadow-lift backdrop-blur transition sm:grid",
        direction === "prev" ? "-left-2" : "-right-2",
        "hover:bg-brand-50 hover:text-brand-700",
        "disabled:pointer-events-none disabled:opacity-0",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d={direction === "prev" ? "m14.5 5-7 7 7 7" : "m9.5 5 7 7-7 7"} />
      </svg>
    </button>
  );
}
