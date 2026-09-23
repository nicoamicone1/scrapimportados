import type { CSSProperties } from "react";

import { StoreLink } from "@/components/store/StoreLink";
import type { CategoryTile } from "@/lib/blocks/select";
import { cn } from "@/lib/cn";

import { SectionTitle } from "./SectionTitle";
import type { BlockProps } from "./types";

/*
 * Categorías (DESIGN.md §6.12):
 * - cards: tiles con foto (propia o del primer producto) + nombre + cantidad.
 * - chips: links de texto con borde y radio pill.
 * - circles: foto circular 96px + nombre (único círculo permitido, sólo con fotos).
 */

function countLabel(n: number) {
  return n === 1 ? "1 producto" : `${n} productos`;
}

function TileImage({ tile, className, sizes }: { tile: CategoryTile; className?: string; sizes?: string }) {
  if (!tile.imageUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imágenes de categorías/productos de cualquier dominio.
    <img
      src={tile.imageUrl}
      alt=""
      sizes={sizes}
      loading="lazy"
      decoding="async"
      className={cn("absolute inset-0 size-full", tile.imageFit === "cover" ? "object-cover" : "object-contain p-[8%]", className)}
    />
  );
}

export function CategoryList({ block, ctx }: BlockProps<"category_list">) {
  const s = block.settings;
  const tiles = ctx.data.categories[block.id] ?? [];
  if (!tiles.length) return null;
  const hover = ctx.theme.cards.hover === "zoom";

  if (s.style === "chips") {
    return (
      <>
        <SectionTitle title={s.title} />
        <ul className="blk-row-scroll" style={{ gap: "8px" }}>
          {tiles.map((t) => (
            <li key={t.id} className="shrink-0">
              <StoreLink href={t.href} className="blk-chip">
                {t.name}
              </StoreLink>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (s.style === "circles") {
    return (
      <>
        <SectionTitle title={s.title} />
        <ul className="blk-row-scroll" style={{ gap: "calc(var(--gap-grid) * 1.5)" }}>
          {tiles.map((t) => (
            <li key={t.id} className="w-[104px] shrink-0">
              <StoreLink href={t.href} className="group flex flex-col items-center gap-2 text-center">
                <span className="relative size-24 overflow-hidden rounded-full bg-surface ring-1 ring-border transition-[box-shadow] duration-150 group-hover:ring-fg">
                  <TileImage tile={t} sizes="96px" />
                </span>
                <span className="text-sm leading-tight group-hover:underline">{t.name}</span>
              </StoreLink>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const cols = Math.max(2, Math.min(s.columns, 6));
  return (
    <>
      <SectionTitle title={s.title} />
      <ul className="blk-cols" style={{ "--m-cols": 2, "--t-cols": Math.min(cols, 3), "--cols": cols } as CSSProperties}>
        {tiles.map((t) => (
          <li key={t.id} className="min-w-0">
            <StoreLink href={t.href} className="group block">
              <span className="relative block overflow-hidden rounded-lg bg-surface" style={{ aspectRatio: "1 / 1" }}>
                <TileImage
                  tile={t}
                  sizes={`(min-width: 1024px) ${Math.round(100 / cols)}vw, 50vw`}
                  className={hover ? "transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]" : undefined}
                />
              </span>
              <span className="mt-[var(--card-pad)] block text-base leading-snug group-hover:underline" style={{ fontWeight: "var(--body-strong-weight)" }}>
                {t.name}
              </span>
              {t.productCount ? <span className="mt-0.5 block text-sm text-fg-muted">{countLabel(t.productCount)}</span> : null}
            </StoreLink>
          </li>
        ))}
      </ul>
    </>
  );
}
