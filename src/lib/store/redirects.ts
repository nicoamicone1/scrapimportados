import "server-only";

import { permanentRedirect } from "next/navigation";

import { createPublicClient } from "@/lib/supabase/server";

/**
 * Redirecciones 301 (P0-02). Se consultan SÓLO cuando una ruta del
 * storefront no encuentra lo pedido (antes de `notFound()`): así no hay
 * costo en las páginas que existen. `hit_redirect` suma el contador y
 * devuelve el destino.
 *
 * (Se hace en las páginas y en el catch-all `[slug]/[...rest]` porque
 * `not-found.tsx` no recibe el path pedido y `src/proxy.ts` es de F.)
 */
export async function redirectIfMoved(path: string): Promise<void> {
  const clean = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (clean === "/" || clean.length > 500) return;
  let target: string | null = null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("hit_redirect", { p_from_path: decodeURI(clean) });
    if (!error && typeof data === "string" && data) target = data;
  } catch (err) {
    console.error("[redirects]", err instanceof Error ? err.message : err);
  }
  // Fuera del try: permanentRedirect lanza a propósito.
  if (target && target !== clean) permanentRedirect(target);
}
