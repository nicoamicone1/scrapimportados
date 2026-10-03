import type { ThemeStyle } from "@/lib/theme/schema";

import type { Block, BlockOf } from "./schema";

/*
 * Disposición efectiva de la portada (DESIGN.md §6.5). Pura: la usan el
 * render del bloque, el constructor (miniaturas) y el storefront (header
 * transparente sólo sobre una foto a sangre).
 */

export type EffectiveHeroLayout = ThemeStyle["hero"];

/**
 * `auto` → la del tema. `cover` sin foto no tiene qué poner a sangre: se
 * compone como `poster` (titular gigante), que sin foto sigue viéndose
 * intencional.
 */
export function resolveHeroLayout(settings: Pick<BlockOf<"hero">["settings"], "layout" | "imageUrl">, themeHero: ThemeStyle["hero"]): EffectiveHeroLayout {
  const layout = settings.layout === "auto" ? themeHero : settings.layout;
  if (layout === "cover" && !settings.imageUrl) return "poster";
  return layout;
}

/**
 * ¿El bloque es una portada con foto a sangre? (El header transparente de la
 * home sólo tiene sentido sobre esa foto; en split/framed/poster/stack, no.)
 */
export function heroIsFullBleed(block: Block | undefined, themeHero: ThemeStyle["hero"]): boolean {
  return block?.type === "hero" && resolveHeroLayout(block.settings, themeHero) === "cover";
}
