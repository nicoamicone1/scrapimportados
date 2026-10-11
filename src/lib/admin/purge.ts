import "server-only";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";

import { chunk, collectStoragePaths } from "@/lib/admin/purge-paths";
import { storeDomainTag, storeTag } from "@/lib/cache-tags";
import { MEDIA_BUCKET } from "@/lib/media";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type { ServerSupabase } from "@/lib/supabase/server";

/*
 * Borrar una tienda para siempre (0026). La base la borra `purge_store`
 * (valida quién, la confirmación y el débito de Mercado Pago, y todo cae en
 * cascada). Después se borran las fotos de `media/<store_id>/…` con la
 * service role: si eso falla la tienda ya no existe y sólo quedan archivos
 * huérfanos sin dueño, así que se informa pero no se revierte.
 */

export interface PurgeResult {
  name: string;
  slug: string;
  filesRemoved: number;
  /** Las fotos no se pudieron borrar (falta la clave o Storage falló). */
  storageWarning: string | null;
}

function storageClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || !SUPABASE_URL) return null;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function removeStoreMedia(storeId: string): Promise<{ removed: number; warning: string | null }> {
  const admin = storageClient();
  if (!admin) return { removed: 0, warning: "Falta SUPABASE_SERVICE_ROLE_KEY: las fotos quedaron en el bucket." };
  const bucket = admin.storage.from(MEDIA_BUCKET);
  try {
    const paths = await collectStoragePaths(storeId, async (prefix, offset, limit) => {
      const { data, error } = await bucket.list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(error.message);
      return (data ?? []).map((e) => ({ name: e.name, id: e.id ?? null }));
    });
    let removed = 0;
    for (const batch of chunk(paths, 500)) {
      const { data, error } = await bucket.remove(batch);
      if (error) throw new Error(error.message);
      removed += data?.length ?? 0;
    }
    return { removed, warning: null };
  } catch (err) {
    console.error("[purge] storage", storeId, err);
    return { removed: 0, warning: "La tienda se borró, pero algunas fotos no se pudieron borrar del bucket." };
  }
}

export async function purgeStore(supabase: ServerSupabase, storeId: string, confirm: string): Promise<PurgeResult> {
  const { data: store } = await supabase.from("stores").select("slug, custom_domain").eq("id", storeId).maybeSingle();
  const { data, error } = await supabase.rpc("purge_store", { p_store_id: storeId, p_confirm: confirm });
  if (error) {
    if (error.code === "PGRST202") {
      throw new PurgeError("Falta aplicar la migración 0026 (borrar tiendas).");
    }
    throw new PurgeError(error.message);
  }
  const res = (data ?? {}) as { slug?: string; name?: string };
  const slug = res.slug ?? store?.slug ?? "";
  const media = await removeStoreMedia(storeId);

  if (slug) revalidateTag(storeTag(slug), "max");
  if (store?.custom_domain) revalidateTag(storeDomainTag(store.custom_domain.toLowerCase()), "max");
  revalidatePath("/platform");
  revalidatePath("/app");

  return { name: res.name ?? slug, slug, filesRemoved: media.removed, storageWarning: media.warning };
}

export class PurgeError extends Error {}
