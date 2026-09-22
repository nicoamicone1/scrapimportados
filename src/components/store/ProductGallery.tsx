"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

/**
 * Galería de la ficha (DESIGN.md §6.3). Desktop: miniaturas verticales a la
 * izquierda + principal con zoom al pasar el mouse. Mobile: scroll-snap
 * horizontal con contador "2/5" (sin dots).
 */
export function ProductGallery({
  images,
  name,
  activeId,
  contain,
}: {
  images: GalleryImage[];
  name: string;
  /** Imagen a mostrar (la asignada a la variante elegida). */
  activeId?: string | null;
  /** `1:1` / `16:9` → contain con padding; `4:5` / `3:4` → cover. */
  contain: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [lastActive, setLastActive] = useState(activeId);

  // La variante elegida cambia la imagen (ajuste de estado durante el render).
  if (activeId !== lastActive) {
    setLastActive(activeId);
    const i = images.findIndex((img) => img.id === activeId);
    if (i >= 0 && i !== index) setIndex(i);
  }

  // Mobile: el track sigue al índice activo.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const target = track.children[index] as HTMLElement | undefined;
    if (target && Math.abs(track.scrollLeft - target.offsetLeft) > 4) track.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  }, [index]);

  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index && i >= 0 && i < images.length) setIndex(i);
  };

  if (!images.length) {
    return <div className="rounded-lg bg-surface" style={{ aspectRatio: "var(--card-ratio)" }} aria-hidden />;
  }

  const fit = contain ? "object-contain p-[6%]" : "object-cover";
  const current = images[index] ?? images[0];

  return (
    <div className="lg:flex lg:gap-4">
      {/* Miniaturas (desktop) */}
      {images.length > 1 ? (
        <ul className="no-scrollbar hidden max-h-[min(80vh,720px)] w-20 shrink-0 flex-col gap-2 overflow-y-auto lg:flex" aria-label="Imágenes del producto">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver imagen ${i + 1} de ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-sm border bg-surface",
                  i === index ? "border-fg" : "border-transparent hover:border-border-strong",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className={cn(contain ? "object-contain p-1" : "object-cover")} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Principal (desktop) con zoom */}
      <div
        className="relative hidden flex-1 cursor-zoom-in overflow-hidden rounded-lg bg-surface lg:block"
        style={{ aspectRatio: "var(--card-ratio)" }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <Image
          key={current.id}
          src={current.url}
          alt={current.alt || name}
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className={cn(fit, "transition-transform duration-150 ease-out")}
          style={zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
      </div>

      {/* Mobile: carrusel con snap */}
      <div className="relative lg:hidden">
        <div
          ref={trackRef}
          onScroll={onTrackScroll}
          className="no-scrollbar -mx-[var(--gutter)] flex snap-x snap-mandatory overflow-x-auto"
          aria-label="Imágenes del producto"
          role="region"
        >
          {images.map((img, i) => (
            <div key={img.id} className="relative w-full shrink-0 snap-start bg-surface" style={{ aspectRatio: "var(--card-ratio)" }}>
              <Image
                src={img.url}
                alt={img.alt || `${name}, imagen ${i + 1}`}
                fill
                priority={i === 0}
                sizes="100vw"
                className={fit}
              />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <span className="tnum absolute right-2 bottom-2 rounded-sm bg-bg px-1.5 py-0.5 text-xs" aria-live="polite">
            {index + 1}/{images.length}
          </span>
        ) : null}
      </div>
    </div>
  );
}
