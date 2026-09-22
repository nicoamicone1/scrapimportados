import type { CSSProperties, ReactNode } from "react";

import type { BannerItem } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";

import { buttonAttrs, SmartLink } from "./Button";
import type { BlockContext, BlockProps } from "./types";

/*
 * BannerGrid (DESIGN.md §6.6)
 * - 1 columna: banner de campaña ancho (21:9 desktop / 4:5 mobile), texto sobre la foto, un botón.
 * - 2 columnas: mitad y mitad, texto abajo a la izquierda sobre la foto, CTA como link.
 * - 3–4 columnas: tiles; texto DEBAJO de la foto (o encima si el ítem tiene overlay > 0).
 * - 3 ítems con ratio `auto`: 1 grande + 2 apilados (2fr/1fr).
 * Mobile: 1 → full · 2 → 2 col · 3 → scroll horizontal (72 %) · 4 → 2×2.
 */

const RATIO: Record<string, string> = { "1:1": "1 / 1", "4:5": "4 / 5", "16:9": "16 / 9", "21:9": "21 / 9" };
const GAP = { none: "0px", sm: "8px", md: "var(--gap-grid)" } as const;

type Mode = "campaign" | "half" | "tile";

function overlayCss(item: BannerItem, mode: Mode): string | undefined {
  if (item.overlay <= 0) return undefined;
  const a = item.overlay / 100;
  const rgb = item.textColor === "dark" ? "255 255 255" : "0 0 0";
  if (item.align === "center") return `rgb(${rgb} / ${a})`;
  return mode === "campaign"
    ? `linear-gradient(to top right, rgb(${rgb} / ${a}) 0%, rgb(${rgb} / ${(a * 0.3).toFixed(3)}) 60%)`
    : `linear-gradient(to top, rgb(${rgb} / ${a}) 0%, rgb(${rgb} / 0) 70%)`;
}

function BannerImage({ item, ctx, eager }: { item: BannerItem; ctx: BlockContext; eager: boolean }) {
  if (!item.imageUrl) return <div aria-hidden className="absolute inset-0 bg-secondary" />;
  const src = ctx.device === "mobile" && item.imageUrlMobile ? item.imageUrlMobile : item.imageUrl;
  return (
    <picture>
      {item.imageUrlMobile && !ctx.device ? <source media="(max-width: 767px)" srcSet={item.imageUrlMobile} /> : null}
      <img src={src} alt={item.title ?? ""} className="blk-media" loading={eager ? "eager" : "lazy"} decoding="async" />
    </picture>
  );
}

function Overlaid({ item, mode, ctx }: { item: BannerItem; mode: Mode; ctx: BlockContext }) {
  const hasImage = Boolean(item.imageUrl);
  const light = hasImage && item.textColor === "light";
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col p-4 @3xl:p-7",
        item.align === "center" ? "items-center justify-center text-center" : "justify-end",
        item.align === "right" && "items-end text-right",
        hasImage ? (light ? "blk-on-image" : "blk-on-image-dark") : "text-fg",
      )}
    >
      <div className={cn(mode === "campaign" ? "max-w-[560px]" : "max-w-[420px]")}>
        {item.title ? (
          <p className={cn("heading", mode === "campaign" && "blk-display")} style={mode === "campaign" ? undefined : { fontSize: "var(--text-xl)", lineHeight: 1.15, textWrap: "balance" }}>
            {item.title}
          </p>
        ) : null}
        {item.subtitle ? (
          <p className={cn("mt-2 opacity-90", mode === "campaign" ? "text-lg" : "text-sm", mode === "tile" && "hidden @3xl:block")}>{item.subtitle}</p>
        ) : null}
        {item.cta?.label ? (
          mode === "campaign" ? (
            <div className="mt-5">
              {/* El banner entero es el link: el botón es sólo visual (sin <a> anidados). */}
              <span className="sbtn" {...buttonAttrs(ctx.theme, hasImage ? "onImage" : "primary")}>
                {item.cta.label}
              </span>
            </div>
          ) : (
            <span className="blk-banner-cta mt-2 inline-block text-sm font-medium underline decoration-1 underline-offset-4">{item.cta.label}</span>
          )
        ) : null}
      </div>
    </div>
  );
}

export function BannerGrid({ block, ctx, index }: BlockProps<"banner_grid">) {
  const s = block.settings;
  const items = s.items.filter((i) => i.imageUrl || i.title);
  if (!items.length) return null;

  const cols = Math.max(1, Math.min(s.columns, 4));
  const mode: Mode = cols === 1 ? "campaign" : cols === 2 ? "half" : "tile";
  const feature = s.ratio === "auto" && items.length === 3 && cols >= 2;
  const full = block.style.container === "full";
  const rounded = s.gap !== "none" && !full;

  const ratio =
    s.ratio !== "auto" ? RATIO[s.ratio] : mode === "campaign" ? "21 / 9" : mode === "half" ? "4 / 5" : "1 / 1";
  // En mobile el banner de campaña pasa a 4:5 (o al ratio elegido si es más alto).
  const ratioMobile = mode === "campaign" && (s.ratio === "auto" || s.ratio === "21:9" || s.ratio === "16:9") ? "4 / 5" : ratio;
  const mobile = cols === 3 && !feature ? "scroll" : undefined;
  // 2 columnas panorámicas no entran de a dos en un celular: se apilan.
  const wide = s.ratio === "16:9" || s.ratio === "21:9";
  const mCols = cols === 1 ? 1 : mode === "half" ? (wide ? 1 : 2) : cols === 4 ? 2 : 1;

  const style = {
    "--blk-gap": GAP[s.gap],
    "--cols": feature ? 2 : Math.min(cols, Math.max(items.length, 1)),
    "--m-cols": mCols,
    "--ratio": ratio,
    "--ratio-m": ratioMobile,
  } as CSSProperties;

  return (
    <div
      className={cn("blk-banners", full && s.gap !== "none" && "px-[var(--blk-gap)]")}
      style={style}
      data-layout={feature ? "feature" : undefined}
      data-mobile={mobile}
      data-full={full ? "" : undefined}
      data-filter={ctx.theme.effects.imageFilter}
    >
      {items.map((item, i) => {
        const href = item.href || item.cta?.href || "";
        const below = mode === "tile" && !feature && item.overlay <= 0 && Boolean(item.imageUrl);
        const itemMode: Mode = feature ? (i === 0 ? "half" : "tile") : mode;
        const content: ReactNode = (
          <>
            <div className={cn("blk-banner-frame", rounded && "blk-rounded")}>
              <BannerImage item={item} ctx={ctx} eager={index === 0 && i < 2} />
              {!below && overlayCss(item, itemMode) ? (
                <div aria-hidden className="absolute inset-0" style={{ background: overlayCss(item, itemMode) }} />
              ) : null}
              <div aria-hidden className="blk-grain" />
              {!below ? <Overlaid item={item} mode={feature && i > 0 ? "tile" : itemMode} ctx={ctx} /> : null}
            </div>
            {below ? (
              <div className="pt-[var(--card-pad)]">
                {item.title ? <p className="text-base font-semibold" style={{ fontWeight: "var(--body-strong-weight)" }}>{item.title}</p> : null}
                {item.subtitle ? <p className="mt-0.5 text-sm text-fg-muted">{item.subtitle}</p> : null}
              </div>
            ) : null}
          </>
        );
        return href ? (
          <SmartLink key={i} href={href} className="blk-banner">
            {content}
          </SmartLink>
        ) : (
          <div key={i} className="blk-banner">
            {content}
          </div>
        );
      })}
    </div>
  );
}
