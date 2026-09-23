import "server-only";

import { revalidateTag } from "next/cache";

import type { AdminContext } from "@/lib/auth";
import { tagFor } from "@/lib/cache-tags";
import { isStoreMediaPath, MEDIA_BUCKET, mediaPathFromUrl } from "@/lib/media";

/*
 * Helpers de escritura compartidos por las actions del catálogo (A):
 * redirecciones al cambiar slugs, borrado de archivos del bucket y
 * revalidación de tags del storefront. Todo opera sobre la tienda activa.
 */

export { MEDIA_BUCKET };

type StoreCtx = Pick<AdminContext, "supabase" | "store">;

/** URL pública del bucket → path dentro del bucket (o null si es externa). */
export const storagePathFromUrl = mediaPathFromUrl;

/**
 * Crea la redirección `from` → `to` (paths relativos) sin dejar cadenas ni
 * bucles: las que apuntaban a `from` pasan a apuntar a `to`, y si existía una
 * redirección DESDE `to` (se volvió al slug viejo) se borra.
 */
export async function upsertRedirect(ctx: StoreCtx & Pick<AdminContext, "user">, from: string, to: string) {
  if (from === to) return;
  const { supabase, store } = ctx;
  await supabase.from("redirects").delete().eq("store_id", store.id).eq("from_path", to);
  await supabase.from("redirects").update({ to_path: to }).eq("store_id", store.id).eq("to_path", from);
  const { error } = await supabase
    .from("redirects")
    .upsert({ store_id: store.id, from_path: from, to_path: to, created_by: ctx.user.id }, { onConflict: "store_id,from_path" });
  if (error) console.error("[redirects]", error.message);
  revalidateTag(tagFor("redirects", store.id), "max");
}

/**
 * Borra del bucket los archivos de estas URLs que ya no use ninguna imagen de
 * producto ni categoría de la tienda (los duplicados copian archivos, pero por
 * las dudas). Sólo toca objetos bajo `<store_id>/…`.
 */
export async function removeMediaIfUnused(ctx: StoreCtx, urls: string[]) {
  const { supabase, store } = ctx;
  const candidates = [...new Set(urls)].filter((u) => {
    const path = mediaPathFromUrl(u);
    return Boolean(path && isStoreMediaPath(path, store.id));
  });
  if (!candidates.length) return;
  const [{ data: stillProducts }, { data: stillCategories }] = await Promise.all([
    supabase.from("product_images").select("url").eq("store_id", store.id).in("url", candidates),
    supabase.from("categories").select("image_url").eq("store_id", store.id).in("image_url", candidates),
  ]);
  const used = new Set([
    ...(stillProducts ?? []).map((r) => r.url),
    ...(stillCategories ?? []).map((r) => r.image_url ?? ""),
  ]);
  const paths = candidates.filter((u) => !used.has(u)).map((u) => mediaPathFromUrl(u) as string);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) console.error("[media]", error.message);
}

/** Revalida el catálogo del storefront de la tienda (y las fichas de estos slugs). */
export function revalidateProducts(storeId: string, slugs: (string | null | undefined)[] = [], categories = false) {
  revalidateTag(tagFor("products", storeId), "max");
  for (const slug of new Set(slugs)) if (slug) revalidateTag(tagFor("product", storeId, slug), "max");
  if (categories) revalidateTag(tagFor("categories", storeId), "max");
}
