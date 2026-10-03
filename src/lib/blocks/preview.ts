import "server-only";

import { headers } from "next/headers";

import type { Theme } from "@/lib/theme";

import type { Block } from "./schema";
import { defaultHomeFor, isStarterPreset } from "./starters";

/*
 * Vista previa por estilo de la tienda demo (`?estilo=<preset>`, S1: el proxy
 * pasa `x-store-preview-style` y `getStoreDisplay` pisa el tema). Con eso
 * activo, la portada muestra la composición de fábrica de ese preset en vez de
 * la guardada: así se ven los 10 inicios con productos reales. Sólo lectura:
 * nunca toca la base.
 */

const PREVIEW_STORE_SLUG = "demo";

/** Preset pedido por `?estilo=` en la demo (o `null` si no hay vista previa). */
export async function previewPresetId(): Promise<string | null> {
  try {
    const h = await headers();
    if (h.get("x-store-slug") !== PREVIEW_STORE_SLUG) return null;
    const id = h.get("x-store-preview-style");
    return id && isStarterPreset(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Bloques de la portada para este request: los de fábrica del preset si hay
 * vista previa, `null` si no (se usan los guardados). La foto de la portada
 * guardada se reusa sólo en los estilos con portada a sangre (atelier,
 * lapacho, bodega); el resto se arma con productos, como una tienda nueva.
 */
export async function previewHomeBlocks(opts: {
  theme: Theme;
  storeName: string;
  transferDiscount: number;
  whatsapp: boolean;
  saved: Block[] | null | undefined;
}): Promise<Block[] | null> {
  const preset = await previewPresetId();
  if (!preset) return null;
  const savedHero = opts.saved?.find((b): b is Extract<Block, { type: "hero" }> => b.type === "hero" && !b.style.hidden);
  const useImage = opts.theme.style.hero === "cover" && Boolean(savedHero?.settings.imageUrl);
  return defaultHomeFor(preset, {
    storeName: opts.storeName,
    transferDiscount: opts.transferDiscount,
    whatsapp: opts.whatsapp,
    heroImageUrl: useImage ? savedHero?.settings.imageUrl : undefined,
    heroImageAlt: useImage ? savedHero?.settings.imageAlt : undefined,
    stableIds: true,
  });
}
