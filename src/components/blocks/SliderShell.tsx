"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { SectionTitle } from "./SectionTitle";

/**
 * Carrusel con scroll-snap (DESIGN.md §6.8): flechas discretas en la línea
 * del título (sólo ≥ 1024px), deshabilitadas en los extremos. Sin dots ni
 * autoplay. Las cards llegan renderizadas desde el server como children.
 */
export function SliderShell({
  title,
  subtitle,
  href,
  arrow,
  perView,
  mobilePeek,
  children,
}: {
  title?: string;
  subtitle?: string;
  href?: string;
  arrow?: boolean;
  perView: number;
  mobilePeek: number;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  const arrows =
    edges.start && edges.end ? null : (
      <div className="blk-arrows items-center gap-1.5">
        <button type="button" className="blk-arrow" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Ver anteriores">
          <ChevronLeft className="size-4" aria-hidden strokeWidth={1.75} />
        </button>
        <button type="button" className="blk-arrow" onClick={() => scroll(1)} disabled={edges.end} aria-label="Ver más">
          <ChevronRight className="size-4" aria-hidden strokeWidth={1.75} />
        </button>
      </div>
    );

  return (
    <>
      <SectionTitle title={title} subtitle={subtitle} href={href} arrow={arrow} aside={arrows} />
      <div
        ref={track}
        className="blk-track"
        role="region"
        aria-label={title || "Productos"}
        tabIndex={0}
        style={{ "--per-view": perView, "--n-mobile": mobilePeek } as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
