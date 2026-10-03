import type { CSSProperties } from "react";

import { StoreLink } from "@/components/store/StoreLink";
import type { CategoryTile } from "@/lib/blocks/select";
import { cn } from "@/lib/cn";

import { SectionTitle } from "./SectionTitle";
import type { BlockProps } from "./types";

/*
 * Categorías (DESIGN.md §6.12):
 * - cards:   tiles con la forma del tema; sin foto, plano de color con el nombre en grande.
 * - chips:   pastillas con la cantidad; se rellenan al pasar.
 * - circles: foto en círculo (en burbuja si el tema es `bubble`); sin foto, la inicial.
 * - list:    lista tipográfica grande, como el índice de una revista; al pasar
 *            el mouse asoma la foto de la categoría (sólo desktop).
 */

function countLabel(n: number) {
  return n === 1 ? "1 producto" : `${n} productos`;
}

function initial(name: string) {
  return (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? "").toUpperCase();
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
      className={cn("absolute inset-0 size-full", tile.imageFit === "cover" ? "object-cover" : "object-contain p-[10%]", className)}
    />
  );
}

export function CategoryList({ block, ctx }: BlockProps<"category_list">) {
  const s = block.settings;
  const tiles = ctx.data.categories[block.id] ?? [];
  if (!tiles.length) return null;
  const zoom = ctx.theme.cards.hover !== "none";

  if (s.style === "chips") {
    return (
      <>
        <SectionTitle title={s.title} />
        <ul className="blk-row-scroll st-stagger" style={{ gap: "8px" }}>
          {tiles.map((t, i) => (
            <li key={t.id} className="shrink-0" style={{ "--i": i % 6 } as CSSProperties}>
              <StoreLink href={t.href} className="blk-chip">
                <span>{t.name}</span>
                {t.productCount ? <span className="blk-chip-n tnum">{t.productCount}</span> : null}
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
        <ul className="blk-row-scroll blk-dots st-stagger">
          {tiles.map((t, i) => (
            <li key={t.id} className="blk-dot-item shrink-0" style={{ "--i": i % 6 } as CSSProperties}>
              <StoreLink href={t.href} className="blk-dot-link group">
                <span className={cn("blk-dot", !t.imageUrl && "blk-dot-plain")} data-tone={i % 3}>
                  {t.imageUrl ? <TileImage tile={t} sizes="112px" className="st-zoom" /> : <span aria-hidden>{initial(t.name)}</span>}
                </span>
                <span className="blk-dot-name">{t.name}</span>
              </StoreLink>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (s.style === "list") {
    return (
      <>
        <SectionTitle title={s.title} />
        <ul className="blk-catlist st-stagger" data-many={tiles.length > 6 ? "" : undefined}>
          {tiles.map((t, i) => (
            <li key={t.id} style={{ "--i": i % 6 } as CSSProperties}>
              <StoreLink href={t.href} className="blk-catlist-row group">
                <span className="blk-catlist-i tnum" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="blk-catlist-name">{t.name}</span>
                {t.productCount ? <span className="blk-catlist-n tnum">{countLabel(t.productCount)}</span> : null}
                <span className="blk-catlist-arrow" aria-hidden>
                  →
                </span>
                {t.imageUrl ? (
                  <span className="blk-catlist-peek blk-shape-sm" aria-hidden>
                    <TileImage tile={t} sizes="200px" />
                  </span>
                ) : null}
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
      <ul className="blk-cols st-stagger" style={{ "--m-cols": 2, "--t-cols": Math.min(cols, 3), "--cols": cols } as CSSProperties}>
        {tiles.map((t, i) => (
          <li key={t.id} className="min-w-0" style={{ "--i": i % 6 } as CSSProperties}>
            <StoreLink href={t.href} className={cn("blk-cat group block", zoom && "st-hover-zoom")}>
              <span className={cn("blk-cat-frame blk-shape", !t.imageUrl && "blk-cat-plain")} data-tone={i % 3}>
                {t.imageUrl ? (
                  <TileImage tile={t} sizes={`(min-width: 1024px) ${Math.round(100 / cols)}vw, 50vw`} className="st-zoom" />
                ) : (
                  <span aria-hidden className="blk-cat-word">
                    {t.name}
                  </span>
                )}
              </span>
              <span className="blk-cat-name">{t.name}</span>
              {t.productCount ? <span className="mt-0.5 block text-sm text-fg-muted">{countLabel(t.productCount)}</span> : null}
            </StoreLink>
          </li>
        ))}
      </ul>
    </>
  );
}
