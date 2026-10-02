import "server-only";

import { unstable_cache } from "next/cache";

import { modulesTag, type ModuleCode } from "@/lib/modules/registry";
import { createPublicClient } from "@/lib/supabase/server";

import { CACHE_REVALIDATE } from "./utils";

/** Sin caché: RPC `store_has_module` (security definer, ejecutable por `anon`). Lanza si falla. */
async function fetchStoreHasModule(storeId: string, code: ModuleCode): Promise<boolean> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("store_has_module", { p_store_id: storeId, p_code: code });
  if (error) throw new Error(`store_has_module: ${error.message}`);
  return data === true;
}

/**
 * ¿La tienda tiene la app activa (o en prueba vigente)? Para el storefront:
 * rutas de la app (`notFound()` si no), bloques del builder, ficha.
 * Tag `modules:<storeId>` (lo revalida el superadmin al activar/desactivar),
 * revalidate 300 s (así un vencimiento se nota en ≤ 5 min).
 * Si la consulta falla (o todavía no está la migración 0022) → `false`, sin cachear el error.
 */
export async function storeHasModule(storeId: string, code: ModuleCode): Promise<boolean> {
  try {
    return await unstable_cache(() => fetchStoreHasModule(storeId, code), ["store-has-module", storeId, code], {
      tags: [modulesTag(storeId)],
      revalidate: CACHE_REVALIDATE,
    })();
  } catch (err) {
    console.error("[modules]", err instanceof Error ? err.message : err);
    return false;
  }
}
