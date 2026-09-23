"use client";

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react";

import type { PlanInfo } from "@/lib/plans";

/**
 * Tienda activa y plan en los Client Components del admin.
 *
 *   const { store, plan, role } = useAdminStore();
 *   uploadImage(file, "products/…")   // usa getClientStoreId() por dentro
 *
 * Lo monta `src/app/admin/(panel)/layout.tsx` con los datos de `requireAdmin()`.
 */

export interface AdminStoreValue {
  store: { id: string; slug: string; name: string; status: string; url: string; href: string };
  plan: PlanInfo;
  role: "owner" | "admin" | "staff";
  impersonating: boolean;
  isPlatformAdmin: boolean;
}

const Ctx = createContext<AdminStoreValue | null>(null);

/*
 * Copia a nivel módulo del store_id activo, para helpers que no son hooks
 * (uploadImage, uploadMedia). La fija el provider al montarse (las subidas
 * siempre ocurren después, por interacción); hay una tienda activa por pestaña.
 */
let activeStoreId: string | null = null;

export function getClientStoreId(): string {
  if (!activeStoreId) throw new Error("No hay una tienda activa en el panel. Recargá la página.");
  return activeStoreId;
}

export function AdminStoreProvider({ value, children }: { value: AdminStoreValue; children: ReactNode }) {
  const id = value.store.id;
  useLayoutEffect(() => {
    activeStoreId = id;
  }, [id]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminStore(): AdminStoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdminStore() fuera de <AdminStoreProvider>");
  return v;
}

/** Igual que `useAdminStore()` pero devuelve `null` fuera del panel (previews, storefront). */
export function useOptionalAdminStore(): AdminStoreValue | null {
  return useContext(Ctx);
}
