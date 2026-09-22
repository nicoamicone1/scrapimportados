import type { CSSProperties, ReactNode } from "react";

import type { Block, BlockStyle } from "@/lib/blocks/schema";
import { cn } from "@/lib/cn";
import { luminance } from "@/lib/theme";

/**
 * Contenedor de cada bloque: aplica `style` (fondo, padding, ancho,
 * ocultar en mobile) y funciona como container query (`.blk`).
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

function backgroundProps(style: BlockStyle): { className?: string; style?: CSSProperties; tone?: "dark" | "light" } {
  switch (style.background) {
    case "surface":
      return { className: "blk-bg-surface" };
    case "primary":
      return { className: "blk-bg-primary" };
    case "custom":
      if (style.customBg && HEX.test(style.customBg)) {
        return {
          className: "blk-bg-custom",
          style: { "--blk-bg": style.customBg } as CSSProperties,
          tone: luminance(style.customBg) < 0.3 ? "dark" : "light",
        };
      }
      return {};
    default:
      return {};
  }
}

/** ¿Va una regla (effects.dividers) entre el bloque anterior y este? */
export function needsDivider(prev: Block | undefined, block: Block): boolean {
  if (!prev) return false;
  const plain = (b: Block) =>
    b.style.background === "default" &&
    b.style.container !== "full" &&
    b.type !== "hero" &&
    b.type !== "divider" &&
    b.type !== "banner_grid" &&
    b.type !== "countdown";
  // El título se pega a su contenido: no se separa del bloque que le sigue.
  return plain(prev) && plain(block) && prev.type !== "heading";
}

export function BlockSection({
  block,
  children,
  className,
  prev,
}: {
  block: Block;
  children: ReactNode;
  className?: string;
  /** Bloque anterior: si es un título, este se le pega (sin espacio arriba, DESIGN.md §2.2). */
  prev?: Block;
}) {
  const s = block.style;
  const bg = backgroundProps(s);
  const glued = prev?.type === "heading" && prev.style.background === s.background && s.background === "default";
  const container =
    s.container === "full" ? null : cn("store-container", s.container === "narrow" && "blk-narrow");

  return (
    <div className="blk" data-block={block.type} data-block-id={block.id}>
      <section
        className={cn(`blk-pad-${s.paddingY}`, bg.className, s.hideOnMobile && "blk-hide-mobile", glued && "blk-glued", className)}
        style={bg.style}
        data-tone={bg.tone}
      >
        {container ? <div className={container}>{children}</div> : children}
      </section>
    </div>
  );
}

/** Regla entre bloques cuando el tema tiene `effects.dividers`. */
export function BlockDivider() {
  return (
    <div className="store-container" aria-hidden>
      <hr className="blk-rule" />
    </div>
  );
}
