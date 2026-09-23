"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/cn";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

/**
 * Alto máximo de la imagen principal en desktop (DESIGN.md §6.3): tiene que
 * entrar completa en el viewport debajo del header sticky.
 * - `100svh − --header-h − 96px`: 96px = lo que hay arriba de la foto en la
 *   primera pantalla (padding de sección + breadcrumb, ~70px en `comfortable`)
 *   + ~24px de aire abajo. Ya sticky (`top: header + 24px`) sobra margen.
 * - Techo 720px: más alto ya no suma detalle (la foto se pide a ≤ 1440px en 2x)
 *   y rompe la relación con el buy box. Piso 400px para ventanas muy bajas.
 */
const MEDIA_H = "clamp(400px, calc(100svh - var(--header-h, 68px) - 96px), 720px)";
/** Ancho máximo = alto máximo × ratio del tema (`--card-ratio` es "4 / 5", "1 / 1"…). */
const MEDIA_MAX_W = "lg:max-w-[calc(var(--pdp-media-h)*var(--card-ratio,1/1))]";

/**
 * `sizes` de la imagen principal. Desktop: el ancho real nunca pasa de techo × ratio
 * (4:5 → 576px, 3:4 → 540px) o de la columna 7/12 (1:1 y 16:9, ≤ ~770px en `wide`).
 * Mobile: 100vw. Desktop y carrusel usan el MISMO `sizes` para que la primera foto
 * resuelva a la misma URL en los dos y se descargue una sola vez.
 */
const mainSizes = (contain: boolean) =>
  contain ? "(min-width: 1280px) 720px, (min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 576px, 100vw";

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * Galería de la ficha (DESIGN.md §6.3). Desktop: miniaturas verticales a la
 * izquierda (mismo alto que la principal, scroll interno) + principal con zoom
 * al pasar el mouse, limitada a `MEDIA_H` y centrada en su columna. Mobile:
 * scroll-snap horizontal con contador "2/5" (sin dots).
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
  const thumbsRef = useRef<HTMLUListElement>(null);
  const [lastActive, setLastActive] = useState(activeId);

  // La variante elegida cambia la imagen (ajuste de estado durante el render).
  if (activeId !== lastActive) {
    setLastActive(activeId);
    const i = images.findIndex((img) => img.id === activeId);
    if (i >= 0 && i !== index) setIndex(i);
  }

  // Mobile: el track sigue al índice activo. Desktop: la miniatura activa
  // queda visible dentro de su columna (sin mover la página).
  useEffect(() => {
    const track = trackRef.current;
    const target = track?.children[index] as HTMLElement | undefined;
    if (track && target && Math.abs(track.scrollLeft - target.offsetLeft) > 4) {
      track.scrollTo({ left: target.offsetLeft, behavior: scrollBehavior() });
    }
    const list = thumbsRef.current;
    const thumb = list?.children[index] as HTMLElement | undefined;
    if (list && thumb && list.clientHeight) {
      const top = thumb.offsetTop;
      const bottom = top + thumb.offsetHeight;
      if (top < list.scrollTop) list.scrollTo({ top, behavior: scrollBehavior() });
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight, behavior: scrollBehavior() });
    }
  }, [index]);

  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index && i >= 0 && i < images.length) setIndex(i);
  };

  const vars = { "--pdp-media-h": MEDIA_H } as CSSProperties;

  if (!images.length) {
    return (
      <div
        className={cn("rounded-lg bg-surface lg:mx-auto", MEDIA_MAX_W)}
        style={{ ...vars, aspectRatio: "var(--card-ratio)" }}
        aria-hidden
      />
    );
  }

  const fit = contain ? "object-contain p-[6%]" : "object-cover";
  const sizes = mainSizes(contain);
  const current = images[index] ?? images[0];

  return (
    <div className="lg:flex lg:justify-center lg:gap-4" style={vars}>
      {/* Miniaturas (desktop): la columna se estira al alto de la principal. */}
      {images.length > 1 ? (
        <div className="relative hidden w-20 shrink-0 lg:block">
          <ul ref={thumbsRef} className="no-scrollbar absolute inset-0 flex flex-col gap-2 overflow-y-auto" aria-label="Imágenes del producto">
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
        </div>
      ) : null}

      {/* Principal (desktop) con zoom: la caja ES el área de la imagen. */}
      <div
        className={cn("relative hidden min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-lg bg-surface lg:block", MEDIA_MAX_W)}
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
          preload
          sizes={sizes}
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
                preload={i === 0}
                sizes={sizes}
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
