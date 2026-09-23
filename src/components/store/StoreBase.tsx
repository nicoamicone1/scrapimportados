"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { storePath } from "@/lib/tenant/urls";

/**
 * Tienda del storefront para Client Components (spec §14.2). Lo monta el
 * layout de `src/app/s/[store]` con lo que resolvió `getTenant()`.
 *
 * - `basePath`: prefijo de los links internos ("" en subdominio/dominio
 *   propio, "/s/<slug>" en modo fallback).
 * - Fuera del provider (p. ej. la vista previa del builder en el admin) el
 *   valor por defecto no antepone nada: los links quedan tal cual.
 */
export interface StoreBase {
  basePath: string;
  storeId: string;
  slug: string;
}

const EMPTY: StoreBase = { basePath: "", storeId: "", slug: "" };

const StoreBaseContext = createContext<StoreBase>(EMPTY);

export function StoreBaseProvider({ basePath, storeId, slug, children }: StoreBase & { children: React.ReactNode }) {
  const value = useMemo(() => ({ basePath, storeId, slug }), [basePath, storeId, slug]);
  return <StoreBaseContext.Provider value={value}>{children}</StoreBaseContext.Provider>;
}

export function useStoreBase(): StoreBase {
  return useContext(StoreBaseContext);
}

/** `(path) => storePath(path, basePath)`: para `router.push`, `fetch`, `action` de forms, etc. */
export function useStorePath(): (path: string) => string {
  const { basePath } = useContext(StoreBaseContext);
  return useCallback((path: string) => storePath(path, basePath), [basePath]);
}
