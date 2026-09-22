import "server-only";

import { revalidateTag } from "next/cache";

import type { ServerSupabase } from "@/lib/supabase/server";

/*
 * Helpers de escritura compartidos por las actions del catálogo (A):
 * redirecciones al cambiar slugs, borrado de archivos del bucket y
 * revalidación de tags del storefront.
 */

export const MEDIA_BUCKET = "media";

/** URL pública del bucket → path dentro del bucket (o null si es externa). */
export function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/**
 * Crea la redirección `from` → `to` (paths relativos) sin dejar cadenas ni
 * bucles: las que apuntaban a `from` pasan a apuntar a `to`, y si existía una
 * redirección DESDE `to` (se volvió al slug viejo) se borra.
 */
export async function upsertRedirect(supabase: ServerSupabase, userId: string, from: string, to: string) {
  if (from === to) return;
  await supabase.from("redirects").delete().eq("from_path", to);
  await supabase.from("redirects").update({ to_path: to }).eq("to_path", from);
  const { error } = await supabase
    .from("redirects")
    .upsert({ from_path: from, to_path: to, created_by: userId }, { onConflict: "from_path" });
  if (error) console.error("[redirects]", error.message);
}

/**
 * Borra del bucket los archivos de estas URLs que ya no use ninguna imagen de
 * producto ni categoría (los duplicados copian archivos, pero por las dudas).
 */
export async function removeMediaIfUnused(supabase: ServerSupabase, urls: string[]) {
  const candidates = [...new Set(urls)].filter((u) => storagePathFromUrl(u));
  if (!candidates.length) return;
  const [{ data: stillProducts }, { data: stillCategories }] = await Promise.all([
    supabase.from("product_images").select("url").in("url", candidates),
    supabase.from("categories").select("image_url").in("image_url", candidates),
  ]);
  const used = new Set([
    ...(stillProducts ?? []).map((r) => r.url),
    ...(stillCategories ?? []).map((r) => r.image_url ?? ""),
  ]);
  const paths = candidates.filter((u) => !used.has(u)).map((u) => storagePathFromUrl(u) as string);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) console.error("[media]", error.message);
}

/** Revalida el catálogo del storefront (y las fichas de estos slugs). */
export function revalidateProducts(slugs: (string | null | undefined)[] = [], categories = false) {
  revalidateTag("products", "max");
  for (const slug of new Set(slugs)) if (slug) revalidateTag(`product:${slug}`, "max");
  if (categories) revalidateTag("categories", "max");
}
