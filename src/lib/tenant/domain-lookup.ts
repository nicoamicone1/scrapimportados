/**
 * Dominio propio → slug, para el proxy (sin `server-only` ni `next/cache`:
 * corre antes de las rutas). Consulta la REST de Supabase como anon y
 * memoiza en memoria del proceso 60 s (incluidos los "no existe").
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const TTL_MS = 60_000;
const memo = new Map<string, { slug: string | null; at: number }>();

export async function lookupStoreSlugByDomain(domain: string): Promise<string | null> {
  const key = domain.toLowerCase();
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.slug;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  let slug: string | null = null;
  try {
    const url = new URL("/rest/v1/stores", SUPABASE_URL);
    url.searchParams.set("select", "slug");
    url.searchParams.set("custom_domain", `eq.${key}`);
    url.searchParams.set("custom_domain_verified", "eq.true");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: "no-store",
    });
    if (res.ok) {
      const rows = (await res.json()) as { slug?: unknown }[];
      slug = typeof rows[0]?.slug === "string" ? rows[0].slug : null;
    }
  } catch (err) {
    console.error("[tenant] dominio", key, err instanceof Error ? err.message : err);
    return null; // no se memoiza un error de red
  }
  if (memo.size > 500) memo.clear();
  memo.set(key, { slug, at: Date.now() });
  return slug;
}
