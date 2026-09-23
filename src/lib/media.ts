/**
 * Rutas del bucket `media` por tienda (spec §14.1): todo objeto vive bajo
 * `<store_id>/…` y la policy `can_manage_media` sólo deja escribir ahí a los
 * miembros de esa tienda. Isomórfico.
 *
 *   mediaPath(storeId, "products", productId, "foto.webp") → "<storeId>/products/<productId>/foto.webp"
 *   mediaPath(storeId, "brand")                            → "<storeId>/brand"
 */

export const MEDIA_BUCKET = "media";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mediaPath(storeId: string, ...parts: string[]): string {
  if (!UUID_RE.test(storeId)) throw new Error("mediaPath: store_id inválido");
  const clean = parts
    .flatMap((p) => p.split("/"))
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..");
  return [storeId, ...clean].join("/");
}

/** ¿El path del bucket pertenece a la tienda (y opcionalmente a una subcarpeta)? */
export function isStoreMediaPath(path: string, storeId: string, ...folder: string[]): boolean {
  const prefix = `${mediaPath(storeId, ...folder)}/`;
  return path.startsWith(prefix) && !path.includes("..");
}

/** Path dentro del bucket a partir de una URL pública de Supabase (o `null`). */
export function mediaPathFromUrl(url: string): string | null {
  const m = /\/storage\/v1\/object\/public\/media\/(.+)$/.exec(url.split("?")[0]);
  return m ? decodeURIComponent(m[1]) : null;
}
