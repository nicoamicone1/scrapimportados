/*
 * Demo «Luna Indumentaria» a medida (docs/DEMO-ROPA.md): todo lo que la
 * tienda `demo` tiene después del seed, en un solo lugar, para que la vista
 * previa local (`ecommy_dev_theme=luna`, sólo desarrollo) y el seed
 * (`scripts/seed-demo-ropa.mts`) muestren exactamente lo mismo. Nada de esto
 * está hardcodeado en el storefront: son datos que un dueño puede cargar
 * desde el panel (tema y CSS, logo, favicon, anuncio, menús, imágenes de
 * categoría y bloques de portada).
 */
import type { Announcement } from "@/lib/store/settings";

import { LUNA_CATEGORY_ORDER } from "./home";

export { LUNA_THEME } from "./theme";
export { LUNA_CATEGORY_ORDER, lunaHomeBlocks, moonPhase, newMoonAt, nextNewMoon, type LunaHomeOptions, type MoonPhase } from "./home";

/** Valor de `store.design` en data/demo-ropa.json y de la cookie de vista previa. */
export const LUNA_DESIGN_ID = "luna";

/** Ruta pública de un asset de Luna (`public/demo/luna/`, servido en cualquier dominio). */
export const lunaAsset = (file: string) => `/demo/luna/${file}`;

export const LUNA_LOGO_URL = lunaAsset("logo.svg");
/** El mismo logo en crema, para los estilos oscuros de la vista previa (`?estilo=neon`, `bodega`). */
export const LUNA_LOGO_LIGHT_URL = lunaAsset("logo-claro.svg");
export const LUNA_FAVICON_URL = lunaAsset("favicon.svg");

/** Banda de anuncio (sobre el header). Lo de transferencia y envío ya va en la marquesina de la portada. */
export const LUNA_ANNOUNCEMENT: Announcement = {
  enabled: true,
  text: "Ropa por fases: una tirada corta por cada luna, cosida en Palermo",
  href: "/#como-comprar",
  bg: "",
  fg: "",
};

/** Imagen de categoría (800 × 1000, se recorta en arco). `origin` = URL absoluta (ver el seed). */
export function lunaCategoryImage(slug: string, origin = ""): string {
  return `${origin.replace(/\/+$/, "")}${lunaAsset(`cat-${slug}.svg`)}`;
}

/** Slugs de categoría que tienen ilustración propia (`cat-<slug>.svg`). */
export const LUNA_CATEGORY_SLUGS: readonly string[] = LUNA_CATEGORY_ORDER;

/**
 * Vista previa local: las categorías de la base todavía no tienen la imagen
 * que les pone el seed (`categories.image_url`). Devuelve los tiles con la
 * ilustración de Luna, como van a quedar en producción.
 */
export function withLunaCategoryImages<T extends { slug: string; imageUrl: string | null; imageFit: "cover" | "contain" }>(
  categories: Record<string, T[]>,
): Record<string, T[]> {
  return Object.fromEntries(
    Object.entries(categories).map(([blockId, tiles]) => [
      blockId,
      tiles.map((t) => (LUNA_CATEGORY_SLUGS.includes(t.slug) ? { ...t, imageUrl: lunaCategoryImage(t.slug), imageFit: "cover" as const } : t)),
    ]),
  );
}

interface LunaMenuItem {
  label: string;
  href: string;
  children: LunaMenuItem[];
}

const item = (label: string, href: string, children: LunaMenuItem[] = []): LunaMenuItem => ({ label, href, children });

/** Menús de la tienda (tabla `menus`, handles `header` y `footer`). */
export const LUNA_MENUS: { header: LunaMenuItem[]; footer: LunaMenuItem[] } = {
  header: [
    item("Colección", "/productos"),
    item("Remeras", "/categoria/remeras"),
    item("Vestidos", "/categoria/vestidos"),
    item("Pantalones", "/categoria/pantalones"),
    item("Cómo comprar", "/#como-comprar"),
  ],
  footer: [
    item("Prendas", "/productos", [
      item("Remeras", "/categoria/remeras"),
      item("Buzos y camperas", "/categoria/buzos-y-camperas"),
      item("Pantalones", "/categoria/pantalones"),
      item("Vestidos", "/categoria/vestidos"),
      item("Camisas", "/categoria/camisas"),
      item("Accesorios", "/categoria/accesorios"),
    ]),
    item("Ayuda", "/#como-comprar", [
      item("Cómo comprar", "/#como-comprar"),
      item("Talles y cambios", "/#como-comprar"),
      item("Carrito", "/carrito"),
    ]),
  ],
};
