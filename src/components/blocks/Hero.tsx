import { cn } from "@/lib/cn";

import { StoreButtonLink } from "./Button";
import type { BlockProps } from "./types";

/**
 * Hero (DESIGN.md §6.5): foto a sangre con overlay orientado al texto,
 * texto abajo a la izquierda (o centrado si el dueño lo elige), un CTA
 * fuerte y el segundo como link. Sin imagen: hero tipográfico.
 */
export function Hero({ block, ctx, index }: BlockProps<"hero">) {
  const s = block.settings;
  const { theme } = ctx;
  const hasImage = Boolean(s.imageUrl);
  const full = block.style.container === "full";
  const center = s.align === "center";
  const a = s.overlay / 100;
  const overlay = center
    ? `rgb(0 0 0 / ${a})`
    : `linear-gradient(to top right, rgb(0 0 0 / ${a}) 0%, rgb(0 0 0 / ${(a * 0.3).toFixed(3)}) 60%)`;
  const src = ctx.device === "mobile" && s.imageUrlMobile ? s.imageUrlMobile : s.imageUrl;
  const priority = index === 0;

  const text = (
    <div className={cn("max-w-[560px]", center && "mx-auto max-w-[720px] text-center")}>
      {s.eyebrow ? <p className="blk-eyebrow mb-3 opacity-90">{s.eyebrow}</p> : null}
      {index === 0 ? <h1 className="blk-display">{s.title}</h1> : <h2 className="blk-display">{s.title}</h2>}
      {s.subtitle ? <p className="mt-4 max-w-[52ch] text-lg leading-snug opacity-90" style={center ? { marginInline: "auto" } : undefined}>{s.subtitle}</p> : null}
      {s.cta.label || s.cta2?.label ? (
        <div className={cn("mt-7 flex flex-wrap items-center gap-x-6 gap-y-3", center && "justify-center")}>
          {s.cta.label ? (
            <StoreButtonLink theme={theme} href={s.cta.href || "/productos"} variant={hasImage ? "onImage" : "primary"}>
              {s.cta.label}
            </StoreButtonLink>
          ) : null}
          {s.cta2?.label ? (
            <StoreButtonLink theme={theme} href={s.cta2.href || "/"} variant="link">
              {s.cta2.label}
            </StoreButtonLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn("blk-hero", hasImage ? "blk-on-image" : "bg-secondary text-fg", !full && "blk-rounded")}
      data-h={s.height}
      data-filter={theme.effects.imageFilter}
    >
      {hasImage ? (
        <>
          <picture>
            {s.imageUrlMobile && !ctx.device ? <source media="(max-width: 767px)" srcSet={s.imageUrlMobile} /> : null}
            <img
              src={src}
              alt={s.imageAlt ?? ""}
              className="blk-media -z-10"
              fetchPriority={priority ? "high" : undefined}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
            />
          </picture>
          <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
          <div aria-hidden className="blk-grain -z-10" />
        </>
      ) : null}
      <div
        className={cn(
          "blk-hero-text",
          full ? "store-container" : "px-[var(--gutter)]",
          center ? "items-center justify-center" : "items-end",
        )}
      >
        {text}
      </div>
    </div>
  );
}
