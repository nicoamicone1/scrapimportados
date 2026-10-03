"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/cn";
import type { Theme } from "@/lib/theme";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

export type GalleryLayout = Theme["style"]["gallery"];

/**
 * Alto máximo de la imagen principal en desktop (DESIGN.md §6.3): tiene que
 * entrar completa en el viewport debajo del header sticky.
 * - `100svh − --header-h − 128px`: 128px = lo que hay arriba de la foto en la
 *   primera pantalla (announcement bar ~24px + padding de sección + breadcrumb,
 *   ~90px en `airy`) + aire abajo. Ya sticky (`top: header + 24px`) sobra margen.
 * - Techo 680px: más alto ya no suma detalle (la foto se pide a ≤ 1360px en 2x)
 *   y rompe la relación con el buy box. Piso 400px para ventanas muy bajas.
 */
const MEDIA_H = "clamp(400px, calc(100svh - var(--header-h, 68px) - 128px), 680px)";
/** Ancho máximo = alto máximo × ratio del tema (`--card-ratio` es "4 / 5", "1 / 1"…). */
const MEDIA_MAX_W = "lg:max-w-[calc(var(--pdp-media-h)*var(--card-ratio,1/1))]";

/**
 * `sizes` de la imagen principal. Desktop: el ancho real nunca pasa de techo × ratio
 * (4:5 → 544px, 3:4 → 510px) o de la columna 7/12 (1:1 y 16:9, ≤ ~770px en `wide`).
 * Mobile: 100vw. Desktop y carrusel usan el MISMO `sizes` para que la primera foto
 * resuelva a la misma URL en los dos y se descargue una sola vez.
 */
const mainSizes = (contain: boolean) =>
  contain ? "(min-width: 1280px) 680px, (min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 544px, 100vw";

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * Galería de la ficha (DESIGN.md §6.3). La disposición de escritorio sale de
 * `theme.style.gallery`:
 * - `thumbs`   miniaturas verticales a la izquierda + principal con zoom al
 *              pasar el mouse, limitada a `MEDIA_H` (la clásica de catálogo).
 * - `grid`     todas las fotos en una grilla de dos columnas (moda: se mira
 *              todo de una, sin clics).
 * - `stack`    las fotos apiladas a ancho completo, una debajo de la otra.
 * - `carousel` carrusel a sangre con la siguiente foto asomando y flechas.
 * En mobile las cuatro son un carrusel con snap y contador "2/5" (sin dots).
 * En `grid` y `stack`, la foto de la variante elegida pasa a ser la primera; con
 * una sola foto, las dos se ven como `thumbs` (la principal con zoom).
 */
export function ProductGallery({
  images,
  name,
  activeId,
  contain,
  layout = "thumbs",
}: {
  images: GalleryImage[];
  name: string;
  /** Imagen a mostrar (la asignada a la variante elegida). */
  activeId?: string | null;
  /** `1:1` / `16:9` → contain con padding; `4:5` / `3:4` → cover. */
  contain: boolean;
  layout?: GalleryLayout;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const wideRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLUListElement>(null);
  const [lastActive, setLastActive] = useState(activeId);

  // La variante elegida cambia la imagen (ajuste de estado durante el render).
  if (activeId !== lastActive) {
    setLastActive(activeId);
    const i = images.findIndex((img) => img.id === activeId);
    if (i >= 0 && i !== index) setIndex(i);
  }

  // Mobile (y el carrusel ancho): el track sigue al índice activo. Desktop
  // thumbs: la miniatura activa queda visible dentro de su columna.
  useEffect(() => {
    for (const track of [trackRef.current, wideRef.current]) {
      const target = track?.children[index] as HTMLElement | undefined;
      if (track && target && track.clientWidth && Math.abs(track.scrollLeft - target.offsetLeft) > 4) {
        track.scrollTo({ left: target.offsetLeft, behavior: scrollBehavior() });
      }
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

  const onTrackScroll = (el: HTMLDivElement | null) => {
    if (!el || !el.clientWidth) return;
    const first = el.children[0] as HTMLElement | undefined;
    const step = first ? first.offsetWidth : el.clientWidth;
    const i = Math.round(el.scrollLeft / Math.max(step, 1));
    if (i !== index && i >= 0 && i < images.length) setIndex(i);
  };

  const vars = { "--pdp-media-h": MEDIA_H } as CSSProperties;

  if (!images.length) {
    return (
      <div className={cn("rounded-lg bg-surface lg:mx-auto", MEDIA_MAX_W)} style={{ ...vars, aspectRatio: "var(--card-ratio)" }} aria-hidden />
    );
  }

  const fit = contain ? "object-contain p-[6%]" : "object-cover";
  const sizes = mainSizes(contain);
  const current = images[index] ?? images[0];
  // grid/stack: la foto activa (variante) va primera.
  const ordered = index > 0 ? [images[index], ...images.filter((_, i) => i !== index)] : images;

  const mobile = (
    <div className="relative lg:hidden">
      <div
        ref={trackRef}
        onScroll={() => onTrackScroll(trackRef.current)}
        className="no-scrollbar -mx-[var(--gutter)] flex snap-x snap-mandatory overflow-x-auto"
        aria-label="Imágenes del producto"
        role="region"
      >
        {images.map((img, i) => (
          <div key={img.id} className="relative w-full shrink-0 snap-start bg-surface" style={{ aspectRatio: "var(--card-ratio)" }}>
            <Image src={img.url} alt={img.alt || `${name}, imagen ${i + 1}`} fill preload={i === 0} sizes={sizes} className={fit} />
          </div>
        ))}
      </div>
      {images.length > 1 ? (
        <span className="pdp-counter tnum absolute right-2 bottom-2 rounded-sm bg-bg px-1.5 py-0.5 text-xs" aria-live="polite">
          {index + 1}/{images.length}
        </span>
      ) : null}
    </div>
  );

  // Con una sola foto, grilla y apiladas no tienen nada que mostrar: va la principal con zoom.
  if ((layout === "grid" || layout === "stack") && images.length > 1) {
    const grid = layout === "grid";
    return (
      <div style={vars}>
        <ul
          className={cn("pdp-shots hidden lg:grid", grid ? "grid-cols-2" : "grid-cols-1")}
          data-layout={layout}
          aria-label="Imágenes del producto"
        >
          {ordered.map((img, i) => (
            <li
              key={img.id}
              className="pdp-shot st-reveal relative overflow-hidden bg-surface"
              style={{ aspectRatio: "var(--card-ratio)" }}
            >
              <Image
                src={img.url}
                alt={img.alt || `${name}, imagen ${i + 1}`}
                fill
                preload={i === 0}
                sizes={grid ? "(min-width: 1024px) 34vw, 100vw" : "(min-width: 1024px) 58vw, 100vw"}
                className={cn(fit, "pdp-shot-img")}
              />
            </li>
          ))}
        </ul>
        {mobile}
      </div>
    );
  }

  if (layout === "carousel") {
    const go = (d: number) => setIndex((i) => Math.min(images.length - 1, Math.max(0, i + d)));
    return (
      <div className="pdp-wide" style={vars}>
        <div className="relative hidden lg:block">
          <div
            ref={wideRef}
            onScroll={() => onTrackScroll(wideRef.current)}
            className="pdp-wide-track no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
            role="region"
            aria-label="Imágenes del producto"
          >
            {images.map((img, i) => (
              <div key={img.id} className={cn("pdp-wide-slide relative shrink-0 snap-start overflow-hidden bg-surface", images.length === 1 && "is-single")}>
                <Image src={img.url} alt={img.alt || `${name}, imagen ${i + 1}`} fill preload={i === 0} sizes="(min-width: 1024px) 66vw, 100vw" className={fit} />
              </div>
            ))}
          </div>
          {images.length > 1 ? (
            <div className="pdp-wide-nav tnum">
              <button type="button" className="pdp-wide-btn" onClick={() => go(-1)} disabled={index === 0} aria-label="Imagen anterior">
                <ChevronLeft className="size-5" aria-hidden strokeWidth={1.75} />
              </button>
              <span className="min-w-12 text-center text-sm" aria-live="polite">
                {index + 1} / {images.length}
              </span>
              <button type="button" className="pdp-wide-btn" onClick={() => go(1)} disabled={index === images.length - 1} aria-label="Imagen siguiente">
                <ChevronRight className="size-5" aria-hidden strokeWidth={1.75} />
              </button>
            </div>
          ) : null}
        </div>
        {mobile}
      </div>
    );
  }

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
                    "pdp-thumb relative block aspect-square w-full overflow-hidden rounded-sm border bg-surface",
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
        className={cn("pdp-main relative hidden min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-lg bg-surface lg:block", MEDIA_MAX_W)}
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
          className={cn(fit, "pdp-main-img transition-transform duration-150 ease-out")}
          style={zoom ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
        />
      </div>

      {mobile}
    </div>
  );
}
