import "server-only";

import { permanentRedirect } from "next/navigation";

import { createPublicClient } from "@/lib/supabase/server";
import { storePath } from "@/lib/tenant/urls";

/**
 * Redirecciones 301 (P0-02). Se consultan SÓLO cuando una ruta del
 * storefront no encuentra lo pedido (antes de `notFound()`): así no hay
 * costo en las páginas que existen. `hit_redirect` suma el contador y
 * devuelve el destino.
 *
 * `path` es el path "de la tienda" (sin el prefijo `/s/<slug>`); el destino
 * interno se re-prefija con `basePath` (los externos van tal cual).
 *
 * (Se hace en las páginas y en el catch-all `[slug]/[...rest]` porque
 * `not-found.tsx` no recibe el path pedido.)
 */
export async function redirectIfMoved(storeId: string, path: string, basePath = ""): Promise<void> {
  const clean = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (clean === "/" || clean.length > 500) return;
  let target: string | null = null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("hit_redirect", { p_store_id: storeId, p_from_path: decodeURI(clean) });
    if (!error && typeof data === "string" && data) target = data;
  } catch (err) {
    console.error("[redirects]", err instanceof Error ? err.message : err);
  }
  // Fuera del try: permanentRedirect lanza a propósito.
  if (target && target !== clean) permanentRedirect(storePath(target, basePath));
}
