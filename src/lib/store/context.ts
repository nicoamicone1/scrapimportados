import "server-only";

import { notFound } from "next/navigation";

import { getTenant, type PublicStore } from "@/lib/tenant/resolve";

export interface StoreContext {
  /** Tienda activa del request. */
  store: PublicStore;
  /** Prefijo de los links internos ("" o "/s/<slug>"): `storePath(path, basePath)`. */
  basePath: string;
}

/**
 * Tienda de una página del storefront a partir de `params.store` (el slug).
 * Si no existe o no está activa → `notFound()` (el layout ya lo corta antes;
 * esto cubre `generateMetadata`, que corre en paralelo). Memoizado por
 * request vía `getTenant()`.
 */
export async function requireStore(params: Promise<{ store: string }>): Promise<StoreContext> {
  const { store: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant.store) notFound();
  return { store: tenant.store, basePath: tenant.basePath };
}
