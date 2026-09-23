import "server-only";

import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { cache } from "react";

import { storeDomainTag, storeTag } from "@/lib/cache-tags";
import { createPublicClient } from "@/lib/supabase/server";

import { classifyHost, parseStorePath, type HostKind } from "./host";
import { fallbackBase } from "./urls";

export { classifyHost, parseStorePath, type HostKind };

/** Headers que fija `src/proxy.ts` (y que se borran si vienen del cliente). */
export const TENANT_HEADERS = {
  site: "x-site",
  slug: "x-store-slug",
  base: "x-store-base",
} as const;

/** Columnas públicas de `stores` (anon sólo puede leer éstas). */
export interface PublicStore {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
}

const PUBLIC_STORE_COLUMNS = "id, slug, name, status, custom_domain, custom_domain_verified";

/** Tienda por slug (sólo activas: RLS de anon). Tag `store:<slug>`. */
export function getStoreBySlug(slug: string): Promise<PublicStore | null> {
  return unstable_cache(
    async (): Promise<PublicStore | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("stores")
        .select(PUBLIC_STORE_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer la tienda ${slug}: ${error.message}`);
      return data;
    },
    ["store-by-slug", slug],
    { tags: [storeTag(slug)], revalidate: 300 },
  )();
}

/** Tienda por dominio propio verificado. Tag `store-domain:<dominio>`. */
export function getStoreByDomain(domain: string): Promise<PublicStore | null> {
  const clean = domain.trim().toLowerCase();
  return unstable_cache(
    async (): Promise<PublicStore | null> => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from("stores")
        .select(PUBLIC_STORE_COLUMNS)
        .eq("custom_domain", clean)
        .eq("custom_domain_verified", true)
        .maybeSingle();
      if (error) throw new Error(`No se pudo resolver el dominio ${clean}: ${error.message}`);
      return data;
    },
    ["store-by-domain", clean],
    { tags: [storeDomainTag(clean)], revalidate: 300 },
  )();
}

export interface Tenant {
  /** Qué sitio se está sirviendo. */
  site: "platform" | "store";
  /** Slug pedido (aunque la tienda no exista). */
  slug: string | null;
  /** Prefijo de los links del storefront: "" (subdominio/dominio) o "/s/<slug>". */
  basePath: string;
  /** Tienda activa resuelta, o `null` si no existe / no está activa. */
  store: PublicStore | null;
}

/**
 * Tenant del request actual (memoizado por request). Lo resuelve el proxy
 * y lo pasa por headers; si faltan (p. ej. un request que no pasó por el
 * proxy) se usa `fallbackSlug` (el `params.store` de `/s/[store]`).
 */
export const getTenant = cache(async (fallbackSlug?: string): Promise<Tenant> => {
  const h = await headers();
  const headerSlug = h.get(TENANT_HEADERS.slug);
  const slug = headerSlug || fallbackSlug || null;
  if (!slug) return { site: "platform", slug: null, basePath: "", store: null };
  const base = h.get(TENANT_HEADERS.base);
  const basePath = base !== null && headerSlug ? base : fallbackBase(slug);
  const store = await getStoreBySlug(slug).catch((err: unknown) => {
    console.error("[tenant]", err instanceof Error ? err.message : err);
    return null;
  });
  return { site: "store", slug, basePath, store };
});

/** Tienda del request o error (para queries del storefront que la necesitan sí o sí). */
export async function requireTenantStore(fallbackSlug?: string): Promise<PublicStore & { basePath: string }> {
  const tenant = await getTenant(fallbackSlug);
  if (!tenant.store) throw new Error("No hay tienda en este request");
  return { ...tenant.store, basePath: tenant.basePath };
}
